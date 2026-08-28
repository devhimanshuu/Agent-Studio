import { describe, it, expect } from "vitest";
import {
  generateEmbedding,
  batchEmbed,
  cosineSimilarity,
  normalizeVector,
  embedLocally,
} from "@/modules/rag/embeddingService";

describe("Embedding Service & Vector Mathematics", () => {
  it("generates deterministic 1536D normalized vectors locally without API keys", async () => {
    const text1 = "PostgreSQL pgvector dense semantic retrieval";
    const result1 = await generateEmbedding({ text: text1, provider: "local" });

    expect(result1.vector).toHaveLength(1536);
    expect(result1.dimensions).toBe(1536);
    expect(result1.provider).toBe("local");

    // Check normalization (unit norm L2 length should be ≈ 1.0)
    const norm = Math.sqrt(result1.vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 4);

    // Same text generates identical vector
    const result2 = await generateEmbedding({ text: text1, provider: "local" });
    expect(result2.vector).toEqual(result1.vector);
  });

  it("calculates accurate cosine similarity between semantic vectors", () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];
    const v4 = [-1, 0, 0];

    expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0, 4);
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(0.0, 4);
    expect(cosineSimilarity(v1, v4)).toBeCloseTo(-1.0, 4);
  });

  it("produces higher similarity for semantically related texts", () => {
    const e1 = embedLocally("PostgreSQL database with vector search indexing");
    const e2 = embedLocally("PostgreSQL database with vector search indexing");
    const e3 = embedLocally("Banana strawberry ice cream recipe");

    const simRelated = cosineSimilarity(e1.vector, e2.vector);
    const simUnrelated = cosineSimilarity(e1.vector, e3.vector);

    expect(simRelated).toBeGreaterThan(simUnrelated);
    expect(simRelated).toBeCloseTo(1.0, 4);
  });

  it("normalizes arbitrary vectors to unit length", () => {
    const raw = [3, 4, 0]; // norm = 5
    const norm = normalizeVector(raw);
    expect(norm[0]).toBeCloseTo(0.6, 4);
    expect(norm[1]).toBeCloseTo(0.8, 4);
    expect(norm[2]).toBe(0);
  });

  it("processes batch embeddings with concurrency limit", async () => {
    const texts = [
      "First chunk text",
      "Second chunk text",
      "Third chunk text",
      "Fourth chunk text",
    ];

    const results = await batchEmbed(texts, { concurrency: 2, provider: "local" });
    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.vector).toHaveLength(1536);
    }
  });

  it("throws error for empty text input", async () => {
    await expect(generateEmbedding({ text: "   " })).rejects.toThrow("Cannot embed empty text");
  });
});
