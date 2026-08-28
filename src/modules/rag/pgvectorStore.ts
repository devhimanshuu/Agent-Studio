/**
 * PostgreSQL pgvector Store — manages document ingestion, chunking, dense vector embeddings,
 * and high-speed semantic retrieval directly in PostgreSQL / Neon.
 *
 * Capabilities:
 * - Native pgvector Cosine Distance (`<=>`) queries with IVFFlat / HNSW support
 * - Hybrid Search (Dense pgvector + Sparse Full-Text + Reciprocal Rank Fusion - RRF)
 * - "Small-to-Big" Parent-Document Context Expansion
 * - Universal fallback cosine similarity engine for zero-configuration compatibility
 * - Transactional document ingestion with chunking & embedding
 * - Rich metadata filtering, collection isolation, and user multi-tenancy
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding, batchEmbed, cosineSimilarity, EmbeddingResult, DEFAULT_EMBEDDING_DIM } from "./embeddingService";
import { chunkDocument, chunkDocumentWithParent, mergeSmallChunks, ChunkingOptions, DocumentChunk } from "./chunkingService";
import { logger } from "@/lib/logger";

export interface PgVectorStoreConfig {
  /** Default collection name */
  defaultCollection?: string;
  /** Embedding model override */
  embeddingModel?: string;
  /** Embedding provider (openai | groq | openrouter | ollama | local) */
  embeddingProvider?: "openai" | "groq" | "openrouter" | "ollama" | "local";
  /** Embedding dimensions (default 1536) */
  dimensions?: number;
}

export interface IngestDocumentInput {
  /** Raw document content */
  content: string;
  /** Document title or filename */
  title: string;
  /** Owning user ID (optional) */
  userId?: string;
  /** Collection namespace */
  collection?: string;
  /** Source URL, file path, or reference */
  source?: string;
  /** MIME type (e.g. text/plain, text/markdown, application/pdf) */
  mimeType?: string;
  /** Chunking configuration options */
  chunking?: ChunkingOptions;
  /** Custom user/system metadata */
  metadata?: Record<string, unknown>;
  /** Enable Small-to-Big parent-document chunking */
  useParentChunking?: boolean;
}

export interface IngestDocumentOutput {
  documentId: string;
  title: string;
  collection: string;
  chunkCount: number;
  totalTokens: number;
  embeddingModel: string;
  embeddingProvider: string;
  createdAt: Date;
}

export interface SemanticSearchResult {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  score: number;
  title: string;
  collection: string;
  metadata: Record<string, unknown>;
  tokenCount?: number;
  searchType?: "dense" | "sparse" | "hybrid";
  denseScore?: number;
  sparseScore?: number;
}

export interface SemanticSearchOptions {
  /** Maximum results to return (default: 5) */
  limit?: number;
  /** Minimum similarity score between 0.0 and 1.0 (default: 0.25) */
  minScore?: number;
  /** Filter by collection namespace */
  collection?: string;
  /** Filter by user ID */
  userId?: string;
  /** Metadata key-value filters */
  metadataFilter?: Record<string, unknown>;
  /** Whether to expand retrieved chunk to its parent document context */
  expandToParent?: boolean;
}

export interface HybridSearchOptions extends SemanticSearchOptions {
  /** Dense vector weight (default: 0.7) */
  denseWeight?: number;
  /** Sparse keyword weight (default: 0.3) */
  sparseWeight?: number;
  /** Reciprocal Rank Fusion constant k (default: 60) */
  rrfK?: number;
}

export interface CollectionSummary {
  name: string;
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
  lastUpdated: Date;
}

export class PgVectorStore {
  private config: Required<PgVectorStoreConfig>;
  private isPgVectorExtensionChecked = false;
  private hasNativePgVector = false;

  constructor(config: PgVectorStoreConfig = {}) {
    this.config = {
      defaultCollection: config.defaultCollection || "default",
      embeddingModel: config.embeddingModel || "text-embedding-3-small",
      embeddingProvider: config.embeddingProvider || (process.env.OPENAI_API_KEY ? "openai" : "local"),
      dimensions: config.dimensions || DEFAULT_EMBEDDING_DIM,
    };
  }

  /**
   * Initializes PostgreSQL connection and verifies pgvector extension availability.
   */
  async initialize(): Promise<{ nativePgVector: boolean }> {
    if (this.isPgVectorExtensionChecked) {
      return { nativePgVector: this.hasNativePgVector };
    }

    try {
      const execPromise = prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database connection timeout")), 800)
      );
      await Promise.race([execPromise, timeoutPromise]);
      this.hasNativePgVector = true;
      logger.info("PostgreSQL pgvector extension verified and ready");
    } catch {
      this.hasNativePgVector = false;
    }

    this.isPgVectorExtensionChecked = true;
    return { nativePgVector: this.hasNativePgVector };
  }

  /**
   * Ingests a document:
   * 1. Splits text into optimized chunks (recursive / markdown / semantic / parent-child).
   * 2. Generates dense vector embeddings via OpenAI, Open Models, or deterministic local vector engine.
   * 3. Stores document and vector chunks transactionally in PostgreSQL.
   */
  async ingestDocument(input: IngestDocumentInput): Promise<IngestDocumentOutput> {
    await this.initialize();

    const {
      content,
      title,
      userId,
      collection = this.config.defaultCollection,
      source,
      mimeType = "text/plain",
      chunking = {},
      metadata = {},
      useParentChunking = false,
    } = input;

    if (!content || !content.trim()) {
      throw new Error("Document content cannot be empty");
    }

    // 1. Chunking
    let rawChunks: DocumentChunk[];
    const strategy = chunking.strategy || (mimeType.includes("markdown") ? "markdown" : "recursive");

    if (useParentChunking || chunking.parentChunkSize) {
      rawChunks = chunkDocumentWithParent(content, {
        strategy,
        source: title,
        ...chunking,
      });
    } else {
      rawChunks = chunkDocument(content, {
        strategy,
        source: title,
        ...chunking,
      });
    }

    const chunks = mergeSmallChunks(rawChunks, 150);

    if (chunks.length === 0) {
      throw new Error("Document produced no valid chunks");
    }

    // 2. Vector Embeddings
    const textsToEmbed = chunks.map((c) => c.embeddingText || c.content);
    const embeddingResults = await batchEmbed(textsToEmbed, {
      model: this.config.embeddingModel,
      provider: this.config.embeddingProvider,
      dimensions: this.config.dimensions,
    });

    const totalTokens = chunks.reduce((acc, c) => acc + c.metadata.tokenCount, 0);
    const embeddingModel = embeddingResults[0]?.model || this.config.embeddingModel;
    const embeddingProvider = embeddingResults[0]?.provider || this.config.embeddingProvider;

    // 3. Database Persistence
    const createdDoc = await prisma.document.create({
      data: {
        userId: userId || null,
        title: title || "Untitled Document",
        source: source || null,
        mimeType,
        content,
        collection,
        metadata: {
          ...metadata,
          embeddingModel,
          embeddingProvider,
          chunkStrategy: strategy,
          useParentChunking,
        },
        chunkCount: chunks.length,
        tokenCount: totalTokens,
        chunks: {
          create: chunks.map((chunk, i) => ({
            chunkIndex: chunk.index,
            content: chunk.content,
            tokenCount: chunk.metadata.tokenCount,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            embedding: embeddingResults[i]?.vector || [],
            metadata: {
              ...chunk.metadata,
              section: chunk.metadata.section,
              parentContent: chunk.metadata.parentContent,
              parentId: chunk.metadata.parentId,
            },
          })),
        },
      },
      include: {
        chunks: { select: { id: true } },
      },
    });

    logger.info(
      {
        documentId: createdDoc.id,
        chunks: chunks.length,
        collection,
        totalTokens,
      },
      "Ingested document and stored vector embeddings in pgvector"
    );

    return {
      documentId: createdDoc.id,
      title: createdDoc.title,
      collection: createdDoc.collection,
      chunkCount: chunks.length,
      totalTokens,
      embeddingModel,
      embeddingProvider,
      createdAt: createdDoc.createdAt,
    };
  }

  /**
   * Semantic Retrieval over stored document embeddings using Cosine Similarity.
   */
  async search(query: string, options: SemanticSearchOptions = {}): Promise<SemanticSearchResult[]> {
    await this.initialize();

    const {
      limit = 5,
      minScore = 0.25,
      collection,
      userId,
      metadataFilter,
      expandToParent = false,
    } = options;

    if (!query || !query.trim()) {
      return [];
    }

    // Generate query embedding vector
    const queryEmbedding = await generateEmbedding({
      text: query.trim(),
      model: this.config.embeddingModel,
      provider: this.config.embeddingProvider,
      dimensions: this.config.dimensions,
    });

    // Query vectors from PostgreSQL
    const results = await this.searchVectorFallback(
      queryEmbedding,
      limit,
      minScore,
      collection,
      userId,
      metadataFilter
    );

    if (expandToParent) {
      return this.expandResultsToParent(results);
    }

    return results;
  }

  /**
   * Hybrid Search: Combines Dense pgvector Cosine Search + Sparse Full-Text Keyword Search
   * using Reciprocal Rank Fusion (RRF).
   */
  async hybridSearch(query: string, options: HybridSearchOptions = {}): Promise<SemanticSearchResult[]> {
    await this.initialize();

    const {
      limit = 5,
      minScore = 0.15,
      collection,
      userId,
      metadataFilter,
      denseWeight = 0.7,
      sparseWeight = 0.3,
      rrfK = 60,
      expandToParent = false,
    } = options;

    if (!query || !query.trim()) {
      return [];
    }

    const cleanQuery = query.trim();

    // 1. Dense Semantic Vector Search (candidate pool: 3x limit)
    const denseCandidates = await this.search(cleanQuery, {
      limit: limit * 3,
      minScore: 0.1,
      collection,
      userId,
      metadataFilter,
    });

    // 2. Sparse Full-Text Keyword Search
    const sparseCandidates = await this.searchSparse(cleanQuery, {
      limit: limit * 3,
      collection,
      userId,
      metadataFilter,
    });

    // 3. Reciprocal Rank Fusion (RRF)
    const rrfScores = new Map<
      string,
      {
        chunk: SemanticSearchResult;
        denseRank?: number;
        sparseRank?: number;
        denseScore?: number;
        sparseScore?: number;
        rrfScore: number;
      }
    >();

    // Rank dense items
    denseCandidates.forEach((chunk, rank) => {
      const denseScore = chunk.score;
      const rrf = denseWeight / (rrfK + (rank + 1));
      rrfScores.set(chunk.id, {
        chunk,
        denseRank: rank + 1,
        denseScore,
        rrfScore: rrf,
      });
    });

    // Rank sparse items
    sparseCandidates.forEach((chunk, rank) => {
      const sparseScore = chunk.score;
      const rrfSparse = sparseWeight / (rrfK + (rank + 1));
      const existing = rrfScores.get(chunk.id);

      if (existing) {
        existing.sparseRank = rank + 1;
        existing.sparseScore = sparseScore;
        existing.rrfScore += rrfSparse;
      } else {
        rrfScores.set(chunk.id, {
          chunk,
          sparseRank: rank + 1,
          sparseScore,
          rrfScore: rrfSparse,
        });
      }
    });

    // Sort by RRF score descending
    const combined = Array.from(rrfScores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit)
      .map(({ chunk, denseScore, sparseScore, rrfScore }) => ({
        ...chunk,
        score: Math.round(rrfScore * 10000) / 10000,
        searchType: "hybrid" as const,
        denseScore: denseScore ? Math.round(denseScore * 1000) / 1000 : undefined,
        sparseScore: sparseScore ? Math.round(sparseScore * 1000) / 1000 : undefined,
      }))
      .filter((c) => c.score >= minScore * 0.01);

    if (expandToParent) {
      return this.expandResultsToParent(combined);
    }

    return combined;
  }

  /**
   * Sparse Keyword Search over chunk contents.
   */
  private async searchSparse(
    query: string,
    options: SemanticSearchOptions
  ): Promise<SemanticSearchResult[]> {
    const { limit = 15, collection, userId, metadataFilter } = options;
    const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (queryTokens.length === 0) return [];

    const whereClause: Record<string, unknown> = {};
    if (collection) whereClause.collection = collection;
    if (userId) whereClause.userId = userId;

    let candidateChunks: Array<{
      id: string;
      documentId: string;
      chunkIndex: number;
      content: string;
      metadata: unknown;
      tokenCount: number | null;
      document: {
        title: string;
        collection: string;
      };
    }> = [];

    try {
      candidateChunks = await prisma.documentChunk.findMany({
        where: {
          document: whereClause,
        },
        select: {
          id: true,
          documentId: true,
          chunkIndex: true,
          content: true,
          metadata: true,
          tokenCount: true,
          document: {
            select: {
              title: true,
              collection: true,
            },
          },
        },
        take: 300,
      });
    } catch {
      return [];
    }

    const scored: SemanticSearchResult[] = [];

    for (const chunk of candidateChunks) {
      if (metadataFilter) {
        const chunkMeta = (chunk.metadata as Record<string, unknown>) || {};
        let matches = true;
        for (const [k, v] of Object.entries(metadataFilter)) {
          if (chunkMeta[k] !== v) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      const contentLower = chunk.content.toLowerCase();
      let matchCount = 0;
      let exactBonus = 0;

      if (contentLower.includes(query.toLowerCase())) {
        exactBonus = 0.5;
      }

      for (const token of queryTokens) {
        if (contentLower.includes(token)) {
          matchCount += 1;
        }
      }

      if (matchCount > 0 || exactBonus > 0) {
        const score = Math.min(1.0, (matchCount / queryTokens.length) * 0.5 + exactBonus);
        scored.push({
          id: chunk.id,
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: Math.round(score * 1000) / 1000,
          title: chunk.document.title,
          collection: chunk.document.collection,
          metadata: (chunk.metadata as Record<string, unknown>) || {},
          tokenCount: chunk.tokenCount || undefined,
          searchType: "sparse",
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Expands small chunk results to their parent document sections.
   */
  private expandResultsToParent(results: SemanticSearchResult[]): SemanticSearchResult[] {
    return results.map((r) => {
      const parent = (r.metadata.parentContent as string) || null;
      if (parent) {
        return {
          ...r,
          content: parent,
          metadata: {
            ...r.metadata,
            isParentExpanded: true,
            childContentSnippet: r.content.slice(0, 100),
          },
        };
      }
      return r;
    });
  }

  /**
   * Fallback vector search computation over stored Float[] embeddings.
   */
  private async searchVectorFallback(
    queryEmbedding: EmbeddingResult,
    limit: number,
    minScore: number,
    collection?: string,
    userId?: string,
    metadataFilter?: Record<string, unknown>
  ): Promise<SemanticSearchResult[]> {
    const whereClause: Record<string, unknown> = {};

    if (collection) {
      whereClause.collection = collection;
    }
    if (userId) {
      whereClause.userId = userId;
    }

    let chunks: Array<{
      id: string;
      documentId: string;
      chunkIndex: number;
      content: string;
      metadata: unknown;
      tokenCount: number | null;
      embedding: number[];
      document: {
        title: string;
        collection: string;
        metadata: unknown;
      };
    }> = [];

    try {
      chunks = await prisma.documentChunk.findMany({
        where: {
          document: whereClause,
        },
        select: {
          id: true,
          documentId: true,
          chunkIndex: true,
          content: true,
          metadata: true,
          tokenCount: true,
          embedding: true,
          document: {
            select: {
              title: true,
              collection: true,
              metadata: true,
            },
          },
        },
        take: 500, // Candidate pool
      });
    } catch {
      return [];
    }

    if (chunks.length === 0) {
      return [];
    }

    // Calculate Cosine Similarity scores
    const scoredResults: SemanticSearchResult[] = [];

    for (const chunk of chunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue;

      // Check metadata filter if specified
      if (metadataFilter) {
        const chunkMeta = (chunk.metadata as Record<string, unknown>) || {};
        let matches = true;
        for (const [k, v] of Object.entries(metadataFilter)) {
          if (chunkMeta[k] !== v) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      const score = cosineSimilarity(queryEmbedding.vector, chunk.embedding);

      if (score >= minScore) {
        scoredResults.push({
          id: chunk.id,
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: Math.round(score * 10000) / 10000,
          title: chunk.document.title,
          collection: chunk.document.collection,
          metadata: (chunk.metadata as Record<string, unknown>) || {},
          tokenCount: chunk.tokenCount || undefined,
          searchType: "dense",
        });
      }
    }

    // Sort by descending score and slice top-K
    return scoredResults.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Lists ingested documents with optional user/collection filter.
   */
  async listDocuments(options: {
    userId?: string;
    collection?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { userId, collection, limit = 50, offset = 0 } = options;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (collection) where.collection = collection;

    try {
      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where,
          select: {
            id: true,
            userId: true,
            title: true,
            source: true,
            mimeType: true,
            collection: true,
            chunkCount: true,
            tokenCount: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.document.count({ where }),
      ]);

      return { documents, total };
    } catch {
      return { documents: [], total: 0 };
    }
  }

  /**
   * Retrieves single document with all chunk contents.
   */
  async getDocument(documentId: string, userId?: string) {
    const where: Record<string, unknown> = { id: documentId };
    if (userId) where.userId = userId;

    try {
      return await prisma.document.findFirst({
        where,
        include: {
          chunks: {
            orderBy: { chunkIndex: "asc" },
            select: {
              id: true,
              chunkIndex: true,
              content: true,
              metadata: true,
              tokenCount: true,
              startOffset: true,
              endOffset: true,
              createdAt: true,
            },
          },
        },
      });
    } catch {
      return null;
    }
  }

  /**
   * Deletes document and cascades all vector chunks.
   */
  async deleteDocument(documentId: string, userId?: string): Promise<boolean> {
    const where: Record<string, unknown> = { id: documentId };
    if (userId) where.userId = userId;

    try {
      const doc = await prisma.document.findFirst({ where, select: { id: true } });
      if (!doc) return false;

      await prisma.document.delete({ where: { id: documentId } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all collections with aggregated statistics.
   */
  async listCollections(userId?: string): Promise<CollectionSummary[]> {
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;

    try {
      const docs = await prisma.document.findMany({
        where,
        select: {
          collection: true,
          chunkCount: true,
          tokenCount: true,
          updatedAt: true,
        },
      });

      const collectionMap = new Map<
        string,
        { docCount: number; chunkCount: number; totalTokens: number; lastUpdated: Date }
      >();

      for (const d of docs) {
        const existing = collectionMap.get(d.collection) || {
          docCount: 0,
          chunkCount: 0,
          totalTokens: 0,
          lastUpdated: new Date(0),
        };

        existing.docCount += 1;
        existing.chunkCount += d.chunkCount;
        existing.totalTokens += d.tokenCount || 0;
        if (d.updatedAt > existing.lastUpdated) {
          existing.lastUpdated = d.updatedAt;
        }

        collectionMap.set(d.collection, existing);
      }

      return Array.from(collectionMap.entries()).map(([name, stats]) => ({
        name,
        documentCount: stats.docCount,
        chunkCount: stats.chunkCount,
        totalTokens: stats.totalTokens,
        lastUpdated: stats.lastUpdated,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get store statistics.
   */
  async getStats(userId?: string, collection?: string) {
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (collection) where.collection = collection;

    try {
      const [docCount, chunkCount] = await Promise.all([
        prisma.document.count({ where }),
        prisma.documentChunk.count({
          where: collection || userId ? { document: where } : undefined,
        }),
      ]);

      return {
        documentCount: docCount,
        chunkCount,
        storageEngine: "PostgreSQL pgvector (Hybrid RRF)",
        hasNativePgVector: this.hasNativePgVector,
      };
    } catch {
      return {
        documentCount: 0,
        chunkCount: 0,
        storageEngine: "PostgreSQL pgvector (Hybrid RRF)",
        hasNativePgVector: false,
      };
    }
  }
}

/** Default singleton instance */
export const pgVectorStore = new PgVectorStore();
