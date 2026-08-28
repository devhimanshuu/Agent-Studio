/**
 * RAG (Retrieval-Augmented Generation) Pipeline Engine
 *
 * End-to-end orchestration for:
 * 1. Document Ingestion (multi-format parsing + hierarchical chunking)
 * 2. Vector Embedding (OpenAI text-embedding-3 / Open Models / Local 1536D normalized vectors)
 * 3. pgvector Storage (PostgreSQL native vector storage with transactional chunk mapping)
 * 4. Semantic Retrieval & Scoring (Cosine similarity + threshold filtering)
 * 5. Prompt Augmentation & RAG Grounded Answer Synthesis
 */

import { PgVectorStore, pgVectorStore, IngestDocumentInput, SemanticSearchResult, SemanticSearchOptions } from "./pgvectorStore";
import { ChunkingOptions } from "./chunkingService";
import { getLLMProvider } from "@/providers/llm";

export interface RAGPipelineConfig {
  /** Maximum context tokens for LLM grounding (default: 4000) */
  maxContextTokens?: number;
  /** Number of chunks to retrieve (default: 5) */
  retrievalLimit?: number;
  /** Minimum similarity score between 0.0 and 1.0 (default: 0.25) */
  minScore?: number;
  /** Default collection name */
  defaultCollection?: string;
  /** Custom vector store instance */
  vectorStore?: PgVectorStore;
}

export interface IngestOptions {
  /** Document text content */
  content: string;
  /** Document title or filename */
  title: string;
  /** Collection namespace */
  collection?: string;
  /** Owning user ID */
  userId?: string;
  /** Document source reference */
  source?: string;
  /** MIME type (e.g. text/markdown, text/plain) */
  mimeType?: string;
  /** Chunking configuration */
  chunking?: ChunkingOptions;
  /** Metadata to store with document & chunks */
  metadata?: Record<string, unknown>;
}

export interface RetrieveOptions {
  /** Search query */
  query: string;
  /** Collection namespace */
  collection?: string;
  /** User ID for isolated tenancy */
  userId?: string;
  /** Max results limit */
  limit?: number;
  /** Minimum similarity score */
  minScore?: number;
  /** Metadata key-value filters */
  metadataFilter?: Record<string, unknown>;
}

export interface RAGResult {
  /** Retrieved context chunks with scores */
  context: Array<{
    id: string;
    documentId: string;
    content: string;
    score: number;
    title: string;
    collection: string;
    section?: string;
    metadata: Record<string, unknown>;
  }>;
  /** Formatted context string ready for LLM prompt insertion */
  formattedContext: string;
  /** Query searched */
  query: string;
  /** Total chunks retrieved */
  chunkCount: number;
  /** Collection searched */
  collection: string;
}

export interface GenerateAnswerResult {
  answer: string;
  query: string;
  sources: Array<{
    title: string;
    score: number;
    snippet: string;
    section?: string;
  }>;
  retrievalCount: number;
  provider: string;
}

/**
 * Production RAG Pipeline class.
 */
export class RAGPipeline {
  private vectorStore: PgVectorStore;
  private config: Required<Omit<RAGPipelineConfig, "vectorStore">>;

  constructor(config: RAGPipelineConfig = {}) {
    this.config = {
      maxContextTokens: config.maxContextTokens || 4000,
      retrievalLimit: config.retrievalLimit || 5,
      minScore: config.minScore !== undefined ? config.minScore : 0.25,
      defaultCollection: config.defaultCollection || "default",
    };
    this.vectorStore = config.vectorStore || pgVectorStore;
  }

  /**
   * Ingests a document into PostgreSQL vector storage.
   */
  async ingest(options: IngestOptions) {
    return this.vectorStore.ingestDocument({
      content: options.content,
      title: options.title,
      collection: options.collection || this.config.defaultCollection,
      userId: options.userId,
      source: options.source,
      mimeType: options.mimeType,
      chunking: options.chunking,
      metadata: options.metadata,
    });
  }

  /**
   * Ingests multiple documents in batch.
   */
  async ingestBatch(documents: IngestOptions[]) {
    const results = [];
    for (const doc of documents) {
      const result = await this.ingest(doc);
      results.push(result);
    }
    return results;
  }

  /**
   * Retrieves relevant context chunks for a query using semantic vector search.
   */
  async retrieve(options: RetrieveOptions): Promise<RAGResult> {
    const {
      query,
      collection = this.config.defaultCollection,
      userId,
      limit = this.config.retrievalLimit,
      minScore = this.config.minScore,
      metadataFilter,
    } = options;

    const searchResults = await this.vectorStore.search(query, {
      limit,
      minScore,
      collection,
      userId,
      metadataFilter,
    });

    const formattedContext = this.formatContext(searchResults);

    return {
      context: searchResults.map((r) => ({
        id: r.id,
        documentId: r.documentId,
        content: r.content,
        score: r.score,
        title: r.title,
        collection: r.collection,
        section: (r.metadata.section as string) || undefined,
        metadata: r.metadata,
      })),
      formattedContext,
      query,
      chunkCount: searchResults.length,
      collection,
    };
  }

  /**
   * Augments a base prompt with retrieved vector context and citations.
   */
  async augmentPrompt(
    query: string,
    basePrompt: string,
    options?: Omit<RetrieveOptions, "query">
  ): Promise<{
    augmentedPrompt: string;
    sources: Array<{ title: string; score: number; content: string; section?: string }>;
    hasContext: boolean;
  }> {
    const result = await this.retrieve({ query, ...options });

    if (result.chunkCount === 0) {
      return {
        augmentedPrompt: `${basePrompt}\n\nUser Question: ${query}`,
        sources: [],
        hasContext: false,
      };
    }

    const contextBlock = result.formattedContext;
    const augmentedPrompt = `${basePrompt}

=== RETRIEVED KNOWLEDGE CONTEXT ===
${contextBlock}
=== END CONTEXT ===

Instructions: Answer the user's question accurately based primarily on the context provided above. Cite your sources using the [Source] tags where applicable.

User Question: ${query}`;

    const sources = result.context.map((c) => ({
      title: c.title,
      score: c.score,
      content: c.content,
      section: c.section,
    }));

    return {
      augmentedPrompt,
      sources,
      hasContext: true,
    };
  }

  /**
   * End-to-end RAG question answering with grounded generation.
   */
  async generateAnswer(
    query: string,
    options?: Omit<RetrieveOptions, "query"> & { systemPrompt?: string }
  ): Promise<GenerateAnswerResult> {
    const systemPrompt =
      options?.systemPrompt ||
      "You are an expert AI research assistant. Provide clear, accurate, well-structured answers grounded in the provided context.";

    const { augmentedPrompt, sources } = await this.augmentPrompt(query, systemPrompt, options);

    const llm = getLLMProvider();
    const completion = await llm.complete([
      { role: "system", content: systemPrompt },
      { role: "user", content: augmentedPrompt },
    ]);

    return {
      answer: completion.content,
      query,
      sources: sources.map((s) => ({
        title: s.title,
        score: s.score,
        snippet: s.content.slice(0, 180) + (s.content.length > 180 ? "..." : ""),
        section: s.section,
      })),
      retrievalCount: sources.length,
      provider: llm.name,
    };
  }

  /**
   * Formats search results into a clean markdown context block.
   */
  private formatContext(results: SemanticSearchResult[]): string {
    if (results.length === 0) return "";

    return results
      .map((r, idx) => {
        const title = r.title || `Source ${idx + 1}`;
        const section = r.metadata.section ? ` > ${r.metadata.section}` : "";
        const scorePct = Math.round(r.score * 100);
        return `[Source ${idx + 1}: ${title}${section} | Relevance: ${scorePct}%]
${r.content}`;
      })
      .join("\n\n---\n\n");
  }

  /**
   * List collections.
   */
  async listCollections(userId?: string) {
    return this.vectorStore.listCollections(userId);
  }

  /**
   * Get store stats.
   */
  async getStats(userId?: string, collection?: string) {
    return this.vectorStore.getStats(userId, collection);
  }
}

/**
 * Creates default RAG pipeline.
 */
export function createRAGPipeline(config: RAGPipelineConfig = {}): RAGPipeline {
  return new RAGPipeline(config);
}

/**
 * Creates RAG pipeline from environment variables.
 */
export function createRAGPipelineFromEnv(): RAGPipeline {
  return new RAGPipeline();
}

/** Default singleton instance */
export const defaultRAGPipeline = new RAGPipeline();

// Re-exports
export { generateEmbedding, batchEmbed, cosineSimilarity, embedLocally } from "./embeddingService";
export { chunkDocument, chunkDocumentWithParent, mergeSmallChunks, estimateTokens, previewChunks } from "./chunkingService";
export { PgVectorStore, pgVectorStore } from "./pgvectorStore";
export { VectorStore, createVectorStore, createVectorStoreFromEnv } from "./vectorStore";
export { rerankCandidates, generateHyDEQuery } from "./reranker";
export { projectVectorsTo2D } from "./clusterVisualizer";
export { evaluateRAGTriad } from "./evaluation";
export type { DocumentChunk, ChunkingOptions } from "./chunkingService";
export type { SemanticSearchResult, IngestDocumentInput, IngestDocumentOutput, HybridSearchOptions } from "./pgvectorStore";
export type { ReRankOptions, ReRankedResult } from "./reranker";
export type { VectorClusterPoint, ClusterMapData } from "./clusterVisualizer";
export type { RAGTriadEvaluationReport, RAGTriadScore } from "./evaluation";
