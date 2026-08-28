import { describe, it, expect, vi, beforeEach } from "vitest";
import { RAGPipeline, createRAGPipeline } from "@/modules/rag";
import { PgVectorStore } from "@/modules/rag/pgvectorStore";
import { prisma } from "@/lib/prisma";

describe("RAG Pipeline & pgvector Engine", () => {
  let pipeline: RAGPipeline;
  let mockVectorStore: PgVectorStore;

  beforeEach(() => {
    mockVectorStore = new PgVectorStore({
      embeddingProvider: "local",
    });
    pipeline = createRAGPipeline({
      vectorStore: mockVectorStore,
      defaultCollection: "test_coll",
      minScore: 0.1,
    });
  });

  it("formats context properly with relevance percentages and source citations", async () => {
    // Mock search method
    vi.spyOn(mockVectorStore, "search").mockResolvedValue([
      {
        id: "c1",
        documentId: "d1",
        chunkIndex: 0,
        content: "pgvector stores embeddings in PostgreSQL and queries with <=> cosine distance.",
        score: 0.92,
        title: "pgvector Guide",
        collection: "test_coll",
        metadata: { section: "Indexing" },
      },
      {
        id: "c2",
        documentId: "d1",
        chunkIndex: 1,
        content: "OpenAI text-embedding-3 produces 1536-dimensional dense vectors.",
        score: 0.75,
        title: "Embedding Overview",
        collection: "test_coll",
        metadata: {},
      },
    ]);

    const result = await pipeline.retrieve({ query: "How does pgvector work?" });

    expect(result.chunkCount).toBe(2);
    expect(result.formattedContext).toContain("[Source 1: pgvector Guide > Indexing | Relevance: 92%]");
    expect(result.formattedContext).toContain("pgvector stores embeddings");
    expect(result.formattedContext).toContain("[Source 2: Embedding Overview | Relevance: 75%]");
  });

  it("augments prompts with retrieved context", async () => {
    vi.spyOn(mockVectorStore, "search").mockResolvedValue([
      {
        id: "c1",
        documentId: "d1",
        chunkIndex: 0,
        content: "PostgreSQL pgvector allows fast vector similarity searches.",
        score: 0.88,
        title: "pgvector Manual",
        collection: "test_coll",
        metadata: {},
      },
    ]);

    const augmented = await pipeline.augmentPrompt(
      "Explain vector search",
      "You are an AI assistant."
    );

    expect(augmented.hasContext).toBe(true);
    expect(augmented.augmentedPrompt).toContain("=== RETRIEVED KNOWLEDGE CONTEXT ===");
    expect(augmented.augmentedPrompt).toContain("PostgreSQL pgvector allows fast vector similarity searches");
    expect(augmented.sources).toHaveLength(1);
    expect(augmented.sources[0].title).toBe("pgvector Manual");
  });

  it("returns unaugmented prompt when no context is found", async () => {
    vi.spyOn(mockVectorStore, "search").mockResolvedValue([]);

    const augmented = await pipeline.augmentPrompt(
      "Unrelated topic",
      "You are an AI assistant."
    );

    expect(augmented.hasContext).toBe(false);
    expect(augmented.sources).toHaveLength(0);
    expect(augmented.augmentedPrompt).toContain("User Question: Unrelated topic");
  });
});
