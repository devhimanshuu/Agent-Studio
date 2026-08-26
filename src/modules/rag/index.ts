/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 *
 * Complete pipeline for:
 * 1. Document ingestion (chunking + embedding + storage)
 * 2. Semantic retrieval (query → embedding → search → context)
 * 3. Context augmentation for LLM responses
 */

import { generateEmbedding } from "./embeddingService";
import { chunkDocument, mergeSmallChunks, ChunkingOptions } from "./chunkingService";
import { VectorStore, VectorStoreConfig, SearchResult, createVectorStoreFromEnv } from "./vectorStore";

export interface RAGPipelineConfig extends VectorStoreConfig {
  /** Maximum context tokens for LLM */
  maxContextTokens?: number;
  /** Number of chunks to retrieve */
  retrievalLimit?: number;
  /** Minimum similarity score */
  minScore?: number;
}

export interface IngestOptions {
  /** Document content */
  content: string;
  /** Document title */
  title?: string;
  /** Collection name */
  collection?: string;
  /** Chunking configuration */
  chunking?: ChunkingOptions;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface RetrieveOptions {
  /** Search query */
  query: string;
  /** Collection to search */
  collection?: string;
  /** Number of results */
  limit?: number;
  /** Minimum score threshold */
  minScore?: number;
}

export interface RAGResult {
  /** Retrieved context chunks */
  context: Array<{
    content: string;
    score: number;
    title?: string;
    section?: string;
  }>;
  /** Formatted context string for LLM */
  formattedContext: string;
  /** Query used */
  query: string;
  /** Total chunks retrieved */
  chunkCount: number;
  /** Collection searched */
  collection: string;
}

/**
 * RAG Pipeline class — orchestrates document ingestion and retrieval.
 */
export class RAGPipeline {
  private vectorStore: VectorStore;
  private config: RAGPipelineConfig;

  constructor(config: RAGPipelineConfig) {
    this.config = {
      maxContextTokens: 4000,
      retrievalLimit: 5,
      minScore: 0.3,
      defaultCollection: "documents",
      ...config,
    };
    this.vectorStore = new VectorStore(config);
  }

  /**
   * Ingest a document into the RAG pipeline.
   * Chunks, embeds, and stores the document.
   */
  async ingest(options: IngestOptions): Promise<{
    documentId: string;
    chunkCount: number;
    collection: string;
  }> {
    return this.vectorStore.ingestDocument({
      content: options.content,
      title: options.title,
      collection: options.collection,
      chunking: options.chunking,
      metadata: options.metadata,
    });
  }

  /**
   * Ingest multiple documents in batch.
   */
  async ingestBatch(
    documents: Array<IngestOptions>
  ): Promise<Array<{
    documentId: string;
    chunkCount: number;
    collection: string;
  }>> {
    const results = [];
    for (const doc of documents) {
      const result = await this.ingest(doc);
      results.push(result);
    }
    return results;
  }

  /**
   * Retrieve relevant context for a query.
   * Returns ranked chunks with similarity scores.
   */
  async retrieve(options: RetrieveOptions): Promise<RAGResult> {
    const {
      query,
      collection = this.config.defaultCollection!,
      limit = this.config.retrievalLimit!,
      minScore = this.config.minScore!,
    } = options;

    // Search for relevant chunks
    const searchResults = await this.vectorStore.search(query, {
      limit,
      minScore,
      collection,
    });

    // Format context for LLM
    const formattedContext = this.formatContext(searchResults);

    return {
      context: searchResults.map(r => ({
        content: r.content,
        score: r.score,
        title: r.title,
        section: r.metadata.section as string,
      })),
      formattedContext,
      query,
      chunkCount: searchResults.length,
      collection,
    };
  }

  /**
   * Retrieve and augment a prompt with relevant context.
   * Useful for RAG-enhanced LLM calls.
   */
  async augmentPrompt(
    query: string,
    basePrompt: string,
    options?: RetrieveOptions
  ): Promise<{
    augmentedPrompt: string;
    sources: Array<{ title: string; content: string }>;
  }> {
    const result = await this.retrieve({ query, ...options });

    if (result.chunkCount === 0) {
      return {
        augmentedPrompt: basePrompt,
        sources: [],
      };
    }

    // Build context block
    const contextBlock = result.formattedContext;
    const augmentedPrompt = `${basePrompt}\n\n---\n\nRelevant Context:\n${contextBlock}\n\n---\n\nBased on the context above, please answer the question: ${query}`;

    const sources = result.context.map(c => ({
      title: c.title || "Unknown",
      content: c.content,
    }));

    return {
      augmentedPrompt,
      sources,
    };
  }

  /**
   * Format search results into a readable context string.
   */
  private formatContext(results: SearchResult[]): string {
    if (results.length === 0) return "";

    return results
      .map((r, i) => {
        const title = r.title || `Source ${i + 1}`;
        const section = r.metadata.section ? ` (${r.metadata.section})` : "";
        const score = `(relevance: ${(r.score * 100).toFixed(0)}%)`;
        return `[${title}${section}] ${score}\n${r.content}`;
      })
      .join("\n\n---\n\n");
  }

  /**
   * Get collection statistics.
   */
  async getStats(collection?: string): Promise<{
    vectorCount: number;
    indexedVectors: number;
  }> {
    return this.vectorStore.getCollectionStats(collection);
  }

  /**
   * List all collections.
   */
  async listCollections(): Promise<string[]> {
    return this.vectorStore.listCollections();
  }
}

/**
 * Create a RAG pipeline from environment variables.
 */
export function createRAGPipelineFromEnv(): RAGPipeline | null {
  const vectorStore = createVectorStoreFromEnv();
  if (!vectorStore) return null;

  return new RAGPipeline({
    host: process.env.QDRANT_HOST!,
    apiKey: process.env.QDRANT_API_KEY,
    embeddingProvider: process.env.OPENAI_API_KEY ? "openai" : 
                       process.env.GROQ_API_KEY ? "groq" : "local",
  });
}

/**
 * Create a RAG pipeline with explicit configuration.
 */
export function createRAGPipeline(config: RAGPipelineConfig): RAGPipeline {
  return new RAGPipeline(config);
}

// Re-export sub-modules for direct access
export { generateEmbedding, batchEmbed, cosineSimilarity } from "./embeddingService";
export { chunkDocument, mergeSmallChunks } from "./chunkingService";
export { VectorStore, createVectorStore, createVectorStoreFromEnv } from "./vectorStore";
export type { DocumentChunk, ChunkingOptions } from "./chunkingService";
export type { SearchResult, VectorStoreConfig } from "./vectorStore";
