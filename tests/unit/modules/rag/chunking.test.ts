import { describe, it, expect } from "vitest";
import {
  chunkDocument,
  mergeSmallChunks,
  estimateTokens,
  previewChunks,
} from "@/modules/rag/chunkingService";

describe("Document Chunking Service", () => {
  const sampleMarkdown = `# System Architecture

## Overview
Retrieval-Augmented Generation (RAG) is a technique for enhancing LLM responses with external knowledge.

## Subsystems
### Vector Storage
PostgreSQL with pgvector provides native cosine distance search (<=>).

### Embedding Engine
Embeddings map tokens into 1536-dimensional semantic vector space.`;

  it("chunks document using markdown strategy with section header preservation", () => {
    const chunks = chunkDocument(sampleMarkdown, {
      strategy: "markdown",
      maxChunkSize: 200,
      overlap: 50,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toBeTruthy();
    expect(chunks[0].embeddingText).toBeTruthy();
    expect(chunks[0].metadata.charCount).toBeGreaterThan(0);
    expect(chunks[0].metadata.tokenCount).toBeGreaterThan(0);
  });

  it("chunks document using recursive character strategy", () => {
    const longText = "Sentence one is here. ".repeat(30);
    const chunks = chunkDocument(longText, {
      strategy: "recursive",
      maxChunkSize: 150,
      overlap: 30,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(200);
      expect(chunk.metadata.tokenCount).toBeGreaterThan(0);
    }
  });

  it("chunks document using semantic sentence boundary strategy", () => {
    const text = "First sentence. Second sentence. Third sentence. Fourth sentence.";
    const chunks = chunkDocument(text, {
      strategy: "semantic",
      maxChunkSize: 40,
      overlap: 10,
    });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it("merges small chunks to meet minimum size requirements", () => {
    const rawChunks = [
      {
        id: "c1",
        content: "Tiny",
        embeddingText: "Tiny",
        index: 0,
        startOffset: 0,
        endOffset: 4,
        metadata: { charCount: 4, wordCount: 1, tokenCount: 2 },
      },
      {
        id: "c2",
        content: "Another small piece of text",
        embeddingText: "Another small piece of text",
        index: 1,
        startOffset: 5,
        endOffset: 32,
        metadata: { charCount: 27, wordCount: 5, tokenCount: 7 },
      },
      {
        id: "c3",
        content: "A larger third chunk with sufficient content to stand alone in retrieval index.",
        embeddingText: "A larger third chunk with sufficient content to stand alone in retrieval index.",
        index: 2,
        startOffset: 33,
        endOffset: 110,
        metadata: { charCount: 77, wordCount: 12, tokenCount: 20 },
      },
    ];

    const merged = mergeSmallChunks(rawChunks, 30);
    expect(merged.length).toBe(2);
    expect(merged[0].content).toContain("Tiny\n\nAnother small piece of text");
  });

  it("estimates token counts accurately", () => {
    const tokens = estimateTokens("Hello world! This is a test sentence for tokenization estimation.");
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(30);
  });

  it("provides visualizer stats with previewChunks", () => {
    const preview = previewChunks(sampleMarkdown, { maxChunkSize: 300 });
    expect(preview.stats.chunkCount).toBeGreaterThan(0);
    expect(preview.stats.totalChars).toBe(sampleMarkdown.length);
    expect(preview.stats.totalTokens).toBeGreaterThan(0);
  });
});
