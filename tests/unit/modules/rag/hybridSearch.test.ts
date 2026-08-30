import { describe, it, expect, vi } from "vitest";
import { PgVectorStore } from "@/modules/rag/pgvectorStore";
import { chunkDocumentWithParent } from "@/modules/rag/chunkingService";

describe("Advanced Hybrid Search & Small-to-Big Retrieval", () => {
  it("chunks documents into leaf children with parent context references", () => {
    const text = `# Architecture Overview

Retrieval-Augmented Generation enhances LLM prompts with verified factual knowledge.

## Vector Storage
PostgreSQL pgvector provides unified vector indexing using cosine distance.

## Evaluation
The RAG Triad evaluates context relevance, groundedness, and answer relevance.`;

    const chunks = chunkDocumentWithParent(text, {
      maxChunkSize: 100,
      parentChunkSize: 400,
      overlap: 20,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.parentContent).toBeTruthy();
    expect(chunks[0].metadata.parentId).toBeTruthy();
  });

  it("executes hybrid search combining dense and sparse results with RRF", async () => {
    const store = new PgVectorStore({ embeddingProvider: "local" });

    // Mock search (dense)
    vi.spyOn(store, "search").mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "doc-1",
        chunkIndex: 0,
        content: "pgvector stores embeddings in PostgreSQL and queries with <=> cosine distance.",
        score: 0.95,
        title: "pgvector Guide",
        collection: "engineering",
        metadata: {},
      },
    ]);

    // Mock searchSparse (sparse)
    vi.spyOn(store as unknown as { searchSparse: (...args: unknown[]) => Promise<unknown> }, "searchSparse").mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "doc-1",
        chunkIndex: 0,
        content: "pgvector stores embeddings in PostgreSQL and queries with <=> cosine distance.",
        score: 0.85,
        title: "pgvector Guide",
        collection: "engineering",
        metadata: {},
        searchType: "sparse",
      },
    ]);

    const results = await store.hybridSearch("pgvector cosine distance", {
      denseWeight: 0.7,
      sparseWeight: 0.3,
      rrfK: 60,
    });

    expect(results.length).toBe(1);
    expect(results[0].searchType).toBe("hybrid");
    expect(results[0].score).toBeGreaterThan(0);
  });
});
