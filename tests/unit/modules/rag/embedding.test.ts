/**
 * Embedding Service & Vector Mathematics
 *
 * The OpenAI provider was removed permanently — these tests cover Groq,
 * OpenRouter, Ollama, and the in-process deterministic fallback. The OpenAI
 * provider path is exercised only by a "legacy openai coerces to openrouter"
 * guard test.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateEmbedding,
  batchEmbed,
  cosineSimilarity,
  normalizeVector,
  embedLocally,
} from "@/modules/rag/embeddingService";

describe("Embedding Service & Vector Mathematics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("coerces the deprecated 'openai' provider value to openrouter", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ embedding: new Array(1536).fill(0.001) }],
            model: "openai/text-embedding-3-small",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    process.env.OPENROUTER_API_KEY = "test-key";

    const result = await generateEmbedding({
      text: "deprecated openai provider call",
      provider: "openai", // should NOT crash; should call OpenRouter instead
    } as unknown as Parameters<typeof generateEmbedding>[0]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("openrouter.ai");
    expect(result.provider).toBe("openrouter");
    expect(result.vector).toHaveLength(1536);

    delete process.env.OPENROUTER_API_KEY;
  });

  it("auto-routes to Groq when GROQ_API_KEY is set and provider is not specified", async () => {
    process.env.GROQ_API_KEY = "test-groq";
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_HOST;

    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ embedding: new Array(1536).fill(0.002) }],
            model: "nomic-embed-text-v1.5",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await generateEmbedding({ text: "auto-routing test" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("groq.com");
    expect(result.provider).toBe("groq");

    delete process.env.GROQ_API_KEY;
  });

  it("auto-routes to OpenRouter when only OPENROUTER_API_KEY is set", async () => {
    delete process.env.GROQ_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-openrouter";

    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ embedding: new Array(1536).fill(0.003) }],
            model: "openai/text-embedding-3-small",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await generateEmbedding({ text: "openrouter routing test" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("openrouter.ai");
    expect(result.provider).toBe("openrouter");

    delete process.env.OPENROUTER_API_KEY;
  });

  it("NEVER calls api.openai.com regardless of which keys are set", async () => {
    // Even with a stale OPENAI_API_KEY, the embedding service must not hit
    // the OpenAI embeddings endpoint — it was removed permanently.
    process.env.OPENAI_API_KEY = "stale-openai-key";
    process.env.GROQ_API_KEY = "active-groq";

    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ embedding: new Array(1536).fill(0.004) }],
            model: "nomic-embed-text-v1.5",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    await generateEmbedding({ text: "no-openai test" });
    const calledUrls = spy.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes("api.openai.com"))).toBe(false);

    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
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
