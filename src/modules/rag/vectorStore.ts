/**
 * Vector Store Service — manages document embeddings in Qdrant.
 *
 * Provides:
 * - Document ingestion with chunking and embedding
 * - Semantic search with relevance scoring
 * - Collection management (create, list, delete)
 * - Batch operations for efficiency
 */

import { generateEmbedding, batchEmbed, cosineSimilarity } from "./embeddingService";
import { chunkDocument, mergeSmallChunks, ChunkingOptions, DocumentChunk } from "./chunkingService";

export interface VectorStoreConfig {
  /** Qdrant host URL */
  host: string;
  /** Qdrant API key (optional) */
  apiKey?: string;
  /** Default collection name */
  defaultCollection?: string;
  /** Embedding model to use */
  embeddingModel?: string;
  /** Embedding provider */
  embeddingProvider?: "groq" | "openai" | "local";
}

export interface IngestDocumentOptions {
  /** Document content */
  content: string;
  /** Document title or filename */
  title?: string;
  /** Collection name */
  collection?: string;
  /** Chunking options */
  chunking?: ChunkingOptions;
  /** Additional metadata to store */
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  /** Chunk content */
  content: string;
  /** Relevance score (0-1) */
  score: number;
  /** Source document title */
  title?: string;
  /** Chunk metadata */
  metadata: Record<string, unknown>;
  /** Point ID in Qdrant */
  pointId: string;
}

export interface SearchOptions {
  /** Number of results to return */
  limit?: number;
  /** Minimum similarity score */
  minScore?: number;
  /** Filter by metadata */
  filter?: Record<string, unknown>;
  /** Collection to search */
  collection?: string;
}

/**
 * Vector Store class for managing document embeddings.
 */
export class VectorStore {
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = {
      defaultCollection: "documents",
      ...config,
    };
  }

  /**
   * Ingest a document into the vector store.
   * Chunks the document, generates embeddings, and stores in Qdrant.
   */
  async ingestDocument(options: IngestDocumentOptions): Promise<{
    documentId: string;
    chunkCount: number;
    collection: string;
  }> {
    const {
      content,
      title,
      collection = this.config.defaultCollection!,
      chunking = {},
      metadata = {},
    } = options;

    // Chunk the document
    const chunks = mergeSmallChunks(chunkDocument(content, chunking));

    if (chunks.length === 0) {
      throw new Error("Document produced no chunks");
    }

    // Generate embeddings for all chunks
    const texts = chunks.map(c => c.content);
    const embeddings = await batchEmbed(texts, {
      model: this.config.embeddingModel,
      provider: this.config.embeddingProvider,
    });

    // Prepare points for Qdrant
    const points = chunks.map((chunk, i) => ({
      id: generatePointId(),
      vector: embeddings[i].vector,
      payload: {
        content: chunk.content,
        title: title || "Untitled",
        chunkIndex: chunk.index,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        charCount: chunk.metadata.charCount,
        wordCount: chunk.metadata.wordCount,
        section: chunk.metadata.section,
        ...metadata,
      },
    }));

    // Upsert to Qdrant
    await this.upsertPoints(collection, points);

    return {
      documentId: points[0].id,
      chunkCount: points.length,
      collection,
    };
  }

  /**
   * Search for similar documents using semantic similarity.
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 5,
      minScore = 0.3,
      collection = this.config.defaultCollection!,
    } = options;

    // Generate query embedding
    const queryEmbedding = await generateEmbedding({
      text: query,
      model: this.config.embeddingModel,
      provider: this.config.embeddingProvider,
    });

    // Search Qdrant using vector similarity
    const results = await this.searchQdrant(collection, queryEmbedding.vector, limit * 2);

    // Filter by minimum score and format results
    return results
      .filter(r => r.score >= minScore)
      .slice(0, limit)
      .map(r => ({
        content: r.payload?.content as string || "",
        score: r.score,
        title: r.payload?.title as string,
        metadata: {
          chunkIndex: r.payload?.chunkIndex,
          section: r.payload?.section,
          charCount: r.payload?.charCount,
          wordCount: r.payload?.wordCount,
        },
        pointId: r.id,
      }));
  }

  /**
   * Delete a document and all its chunks from the collection.
   */
  async deleteDocument(documentId: string, collection?: string): Promise<void> {
    const coll = collection || this.config.defaultCollection!;
    await this.deletePoints(coll, [documentId]);
  }

  /**
   * List all collections in the vector store.
   */
  async listCollections(): Promise<string[]> {
    const host = this.config.host.replace(/\/+$/, "");
    const headers = this.getHeaders();

    const res = await fetch(`${host}/collections`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to list collections: ${res.status}`);
    }

    const json = await res.json() as { collections?: Array<{ name: string }> };
    return json.collections?.map(c => c.name) || [];
  }

  /**
   * Get collection statistics.
   */
  async getCollectionStats(collection?: string): Promise<{
    vectorCount: number;
    indexedVectors: number;
  }> {
    const coll = collection || this.config.defaultCollection!;
    const host = this.config.host.replace(/\/+$/, "");
    const headers = this.getHeaders();

    const res = await fetch(`${host}/collections/${encodeURIComponent(coll)}`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to get collection stats: ${res.status}`);
    }

    const json = await res.json() as {
      result?: {
        vectors_count?: number;
        indexed_vectors_count?: number;
      };
    };

    return {
      vectorCount: json.result?.vectors_count || 0,
      indexedVectors: json.result?.indexed_vectors_count || 0,
    };
  }

  /**
   * Create a new collection with appropriate settings.
   */
  async createCollection(
    name: string,
    vectorSize: number = 384
  ): Promise<void> {
    const host = this.config.host.replace(/\/+$/, "");
    const headers = this.getHeaders();

    const res = await fetch(`${host}/collections/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance: "Cosine",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Failed to create collection ${name}: ${res.status} ${errText}`);
    }
  }

  // Private helper methods

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.apiKey) {
      headers["api-key"] = this.config.apiKey;
    }
    return headers;
  }

  private async upsertPoints(
    collection: string,
    points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>
  ): Promise<void> {
    const host = this.config.host.replace(/\/+$/, "");
    const headers = this.getHeaders();

    const res = await fetch(
      `${host}/collections/${encodeURIComponent(collection)}/points`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ points }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Failed to upsert points: ${res.status} ${errText}`);
    }
  }

  private async searchQdrant(
    collection: string,
    vector: number[],
    limit: number
  ): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
    const host = this.config.host.replace(/\/+$/, "");
    const headers = this.getHeaders();

    const res = await fetch(
      `${host}/collections/${encodeURIComponent(collection)}/points/search`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          vector,
          limit,
          with_payload: true,
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Failed to search vectors: ${res.status} ${errText}`);
    }

    const json = await res.json() as {
      result?: Array<{ id: string; score: number; payload: Record<string, unknown> }>;
    };

    return json.result || [];
  }

  private async deletePoints(collection: string, pointIds: string[]): Promise<void> {
    const host = this.config.host.replace(/\/+$/, "");
    const headers = this.getHeaders();

    const res = await fetch(
      `${host}/collections/${encodeURIComponent(collection)}/points/delete`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ points: pointIds }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Failed to delete points: ${res.status} ${errText}`);
    }
  }
}

/**
 * Generate a unique point ID for Qdrant.
 */
function generatePointId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a VectorStore instance from environment variables.
 */
export function createVectorStoreFromEnv(): VectorStore | null {
  const host = process.env.QDRANT_HOST;
  if (!host) return null;

  return new VectorStore({
    host,
    apiKey: process.env.QDRANT_API_KEY,
    embeddingProvider: process.env.OPENAI_API_KEY ? "openai" : 
                       process.env.GROQ_API_KEY ? "groq" : "local",
  });
}

/**
 * Create a VectorStore instance with explicit configuration.
 */
export function createVectorStore(config: VectorStoreConfig): VectorStore {
  return new VectorStore(config);
}
