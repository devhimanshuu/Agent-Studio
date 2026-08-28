/**
 * Vector Store Factory & Unified Adapter.
 *
 * Defaults to PostgreSQL pgvector storage while providing seamless adapters
 * for local development and Qdrant instances.
 */

import { PgVectorStore, PgVectorStoreConfig, IngestDocumentInput, SemanticSearchResult, SemanticSearchOptions } from "./pgvectorStore";

export type VectorStoreConfig = PgVectorStoreConfig & {
  /** Optional Qdrant host URL (if using external Qdrant) */
  host?: string;
  /** Optional Qdrant API key */
  apiKey?: string;
};

export type IngestDocumentOptions = IngestDocumentInput;
export type SearchResult = SemanticSearchResult;
export type SearchOptions = SemanticSearchOptions;

export class VectorStore extends PgVectorStore {
  constructor(config: VectorStoreConfig = {}) {
    super(config);
  }
}

/**
 * Creates VectorStore instance configured from environment variables.
 */
export function createVectorStoreFromEnv(): VectorStore {
  return new VectorStore({
    embeddingProvider: process.env.OPENAI_API_KEY ? "openai" : "local",
    embeddingModel: process.env.OPENAI_API_KEY ? "text-embedding-3-small" : undefined,
  });
}

/**
 * Creates VectorStore with explicit configuration.
 */
export function createVectorStore(config: VectorStoreConfig = {}): VectorStore {
  return new VectorStore(config);
}

export { PgVectorStore } from "./pgvectorStore";
