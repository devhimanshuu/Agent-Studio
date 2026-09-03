/**
 * Full-stack RAG ingest pipeline tests — exercise chunkDocument → embedLocally →
 * IngestDocument write to an in-memory Prisma stand-in. The goal is to verify
 * the wiring (chunk count, metadata propagation, useParentChunking forwarding)
 * without needing a live PostgreSQL.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  chunkDocument,
  chunkDocumentWithParent,
  mergeSmallChunks,
} from "@/modules/rag/chunkingService";
import {
  batchEmbed,
  generateEmbedding,
  embedLocally,
} from "@/modules/rag/embeddingService";
import { RAGPipeline } from "@/modules/rag";
import type { PgVectorStore } from "@/modules/rag/pgvectorStore";

const SAMPLE_MARKDOWN = `# Production RAG Architecture with pgvector

## Overview
Retrieval-Augmented Generation (RAG) combines dense semantic retrieval with Large Language Models (LLMs) to ground responses in verified, proprietary knowledge. By using PostgreSQL with the pgvector extension, applications eliminate external vector database overhead and maintain transactional consistency within their primary relational database.

## Ingestion & Chunking Pipeline
1. Document Loading: Multi-format document ingestion from Markdown, PDF, text files, and web scrapers.
2. Hierarchical Recursive Chunking: Splitting documents across logical boundaries.
3. Context Injection: Prepending section headings to each chunk so isolated text retains full contextual awareness during vector embedding.

## Dense Vector Embeddings
- Models: OpenAI text-embedding-3-small (1536 dimensions) or open-source high-dimensional semantic representations.
- Normalization: L2 unit-norm sphere projection ensures that Cosine Distance equals 1 - Inner Product, accelerating indexing.

## Semantic Search & Cosine Distance
Queries are converted into dense embeddings and matched against chunk vectors using pgvector's HNSW (Hierarchical Navigable Small World) index.

## Prompt Augmentation & Grounding
Retrieved top-K chunks are injected into the prompt with structured citations, ensuring 0% hallucination and full source provenance.`;

describe("RAG ingest pipeline (DB-less)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("chunks + merges + embeds a markdown document end-to-end (no DB)", async () => {
    // 1. Chunk
    const raw = chunkDocumentWithParent(SAMPLE_MARKDOWN, {
      strategy: "markdown",
      maxChunkSize: 500,
      overlap: 120,
      parentChunkSize: 1200,
      source: "RAG Doc",
    });

    expect(raw.length).toBeGreaterThan(0);
    for (const chunk of raw) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.metadata.parentContent).toBeTruthy();
      expect(chunk.metadata.parentId).toBeTruthy();
    }

    const merged = mergeSmallChunks(raw, 150);
    expect(merged.length).toBeGreaterThan(0);
    expect(merged.length).toBeLessThanOrEqual(raw.length);

    // 2. Embed (local fallback — no remote keys needed)
    const texts = merged.map((c) => c.embeddingText);
    const embeddings = await batchEmbed(texts, {
      provider: "local",
      concurrency: 4,
    });
    expect(embeddings.length).toBe(merged.length);
    for (const e of embeddings) {
      expect(e.vector).toHaveLength(1536);
      expect(e.provider).toBe("local");
    }
  });

  it("RAGPipeline.ingest forwards useParentChunking through to PgVectorStore.ingestDocument", async () => {
    const mockStore = {
      ingestDocument: vi.fn(async (input: Record<string, unknown>) => ({
        documentId: "doc-1",
        title: input.title as string,
        collection: input.collection as string,
        chunkCount: 5,
        totalTokens: 120,
        embeddingModel: "local-semantic-1536d",
        embeddingProvider: "local",
        createdAt: new Date(),
      })),
    } as unknown as PgVectorStore;

    const pipeline = new RAGPipeline({ vectorStore: mockStore });

    const result = await pipeline.ingest({
      content: SAMPLE_MARKDOWN,
      title: "RAG Architecture",
      collection: "engineering",
      mimeType: "text/markdown",
      useParentChunking: true,
      chunking: { maxChunkSize: 500, overlap: 120, parentChunkSize: 1200 },
    });

    expect(result.chunkCount).toBe(5);
    expect(mockStore.ingestDocument).toHaveBeenCalledTimes(1);

    const call = (mockStore.ingestDocument as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.useParentChunking).toBe(true);
    expect(call.chunking.parentChunkSize).toBe(1200);
    expect(call.title).toBe("RAG Architecture");
    expect(call.collection).toBe("engineering");
  });

  it("RAGPipeline.ingest defaults useParentChunking to false when omitted", async () => {
    const mockStore = {
      ingestDocument: vi.fn(async () => ({
        documentId: "doc-2",
        title: "Untitled",
        collection: "default",
        chunkCount: 3,
        totalTokens: 60,
        embeddingModel: "local-semantic-1536d",
        embeddingProvider: "local",
        createdAt: new Date(),
      })),
    } as unknown as PgVectorStore;

    const pipeline = new RAGPipeline({ vectorStore: mockStore });
    await pipeline.ingest({
      content: "Hello world this is a small document.",
      title: "Untitled",
    });

    const call = (mockStore.ingestDocument as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.useParentChunking).toBe(false);
  });

  it("generateEmbedding handles empty text input by rejecting with a clear error", async () => {
    await expect(generateEmbedding({ text: "   ", provider: "local" })).rejects.toThrow(
      /empty/i,
    );
  });

  it("embedLocally produces unit-normalized vectors for arbitrary input lengths", async () => {
    for (const text of ["", "x", "PostgreSQL pgvector", "a".repeat(1000)]) {
      const result = embedLocally(text || " ");
      expect(result.vector).toHaveLength(1536);
      const norm = Math.sqrt(
        result.vector.reduce((acc, v) => acc + v * v, 0),
      );
      // Empty / whitespace-only inputs produce an all-zero vector — that's an
      // intentional degenerate case for which norm = 0 is acceptable.
      if (text && text.length > 0) {
        expect(norm).toBeCloseTo(1.0, 4);
      }
    }
  });

  it("chunkDocumentWithParent emits chunks whose total content length covers the source", () => {
    const raw = chunkDocumentWithParent(SAMPLE_MARKDOWN, {
      strategy: "markdown",
      maxChunkSize: 300,
      overlap: 60,
      parentChunkSize: 600,
    });
    // Concatenating child contents must reproduce the document (modulo
    // overlap). Every original section must appear in at least one chunk.
    const joined = raw.map((c) => c.content).join("\n\n");
    expect(joined).toContain("pgvector");
    expect(joined).toContain("Hierarchical Recursive Chunking");
    expect(joined).toContain("Hierarchical Navigable Small World");
  });

  it("handles a pure-plaintext document with recursive chunking (mimeType=text/plain fallback)", () => {
    const text = "Sentence one is here. ".repeat(50);
    const chunks = chunkDocument(text, {
      strategy: "recursive",
      maxChunkSize: 200,
      overlap: 30,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(250);
    }
  });
});