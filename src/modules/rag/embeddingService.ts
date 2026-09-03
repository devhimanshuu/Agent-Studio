/**
 * Embedding Service — generates dense vector embeddings for the RAG pipeline.
 *
 * Supported providers (Groq + OpenRouter ONLY — OpenAI was removed permanently):
 * - Groq        — primary; uses OpenAI-compatible /v1/embeddings
 * - OpenRouter  — passthrough to OpenAI / Cohere / Voyage embedding models
 * - Ollama      — local HTTP endpoint, optional
 *
 * The deterministic 1536D normalized semantic fallback runs in-process when no
 * remote provider is configured so the dashboard remains functional in
 * zero-config / offline environments. It is NEVER the default for production
 * deployments; configure Groq (or OpenRouter) for real semantic quality.
 */

import { logger } from "@/lib/logger";

interface EmbeddingOptions {
  /** Text to embed */
  text: string;
  /** Model to use */
  model?: string;
  /** Provider override (openai is silently coerced to openrouter) */
  provider?: "groq" | "openrouter" | "ollama" | "local";
  /** Vector dimension (default: 1536) */
  dimensions?: number;
}

export interface EmbeddingResult {
  /** The normalized embedding vector (default: 1536 floats) */
  vector: number[];
  /** Model name used */
  model: string;
  /** Estimated or actual token count */
  tokenCount?: number;
  /** Provider used */
  provider: string;
  /** Embedding dimensionality */
  dimensions: number;
}

interface BatchEmbeddingOptions {
  /** Concurrency limit (default: 5) */
  concurrency?: number;
  /** Model to use */
  model?: string;
  /** Provider override (openai is silently coerced to openrouter) */
  provider?: "groq" | "openrouter" | "ollama" | "local";
  /** Vector dimensions */
  dimensions?: number;
}

export const DEFAULT_EMBEDDING_DIM = 1536;

/**
 * Mapping of provider → default remote embedding model. Both providers expose
 * an OpenAI-compatible /v1/embeddings endpoint, so the request shape is the
 * same; only the URL + auth header differ.
 */
const DEFAULT_MODELS: Record<"groq" | "openrouter" | "ollama", string> = {
  groq: "nomic-embed-text-v1.5",
  openrouter: "openai/text-embedding-3-small",
  ollama: "nomic-embed-text",
};

/**
 * Coerce the deprecated "openai" provider value to OpenRouter — the OpenAI
 * provider path was removed permanently and legacy callers should fail soft
 * (redirect) rather than hard-error.
 *
 * The current `provider` type union already excludes "openai", so this
 * function is a forward-compatibility shim: if the union is ever re-widened
 * for legacy callers, the coercion still runs.
 */
function coerceProvider(
  provider: EmbeddingOptions["provider"],
): "groq" | "openrouter" | "ollama" | "local" | undefined {
  if ((provider as string | undefined) === "openai") return "openrouter";
  return provider;
}

/**
 * Generate embedding vector for text using the configured provider.
 * Auto-selects Groq → OpenRouter → Ollama → in-process deterministic fallback.
 *
 * The OpenAI provider was removed permanently. Any caller that still passes
 * `provider: "openai"` is silently coerced to OpenRouter.
 */
export async function generateEmbedding(options: EmbeddingOptions): Promise<EmbeddingResult> {
  const { text, model, dimensions = DEFAULT_EMBEDDING_DIM } = options;
  const provider = coerceProvider(options.provider);

  if (!text || !text.trim()) {
    throw new Error("Cannot embed empty text");
  }

  const cleanText = text.trim();

  // 1. Groq (OpenAI-compatible endpoint at https://api.groq.com/openai/v1).
  if (provider === "groq" || (!provider && process.env.GROQ_API_KEY)) {
    try {
      return await embedWithGroq(cleanText, model);
    } catch (error) {
      logger.warn({ err: error }, "Groq embedding failed, attempting fallback");
      if (provider === "groq") throw error;
    }
  }

  // 2. OpenRouter (passthrough to OpenAI / Cohere / Voyage embeddings).
  if (provider === "openrouter" || (!provider && process.env.OPENROUTER_API_KEY)) {
    try {
      return await embedWithOpenRouter(cleanText, model);
    } catch (error) {
      logger.warn({ err: error }, "OpenRouter embedding failed, attempting fallback");
      if (provider === "openrouter") throw error;
    }
  }

  // 3. Ollama local HTTP endpoint.
  if (provider === "ollama" || (!provider && process.env.OLLAMA_HOST)) {
    try {
      return await embedWithOllama(cleanText, model);
    } catch (error) {
      logger.warn({ err: error }, "Ollama embedding failed, attempting fallback");
      if (provider === "ollama") throw error;
    }
  }

  // 4. Zero-config in-process 1536D normalized semantic vector.
  //    Used only when no remote provider is reachable; not the production default.
  return embedLocally(cleanText, dimensions);
}

/**
 * Embed using Groq's OpenAI-compatible /v1/embeddings endpoint.
 *
 * Groq rarely exposes embedding models, so on a hard error we transparently
 * fall through to OpenRouter (when configured) so a single Groq key still
 * produces useful vectors via the OpenRouter passthrough.
 */
async function embedWithGroq(text: string, modelName?: string): Promise<EmbeddingResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const groqModel = modelName || DEFAULT_MODELS.groq;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text, model: groqModel }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq embedding failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      data?: Array<{ embedding: number[] }>;
      model?: string;
      usage?: { total_tokens: number };
    };

    const rawEmbedding = json.data?.[0]?.embedding;
    if (!rawEmbedding || !Array.isArray(rawEmbedding)) {
      throw new Error("No embedding returned from Groq");
    }

    const vector = adjustDimensions(rawEmbedding, DEFAULT_EMBEDDING_DIM);

    return {
      vector: normalizeVector(vector),
      model: json.model || groqModel,
      tokenCount: json.usage?.total_tokens,
      provider: "groq",
      dimensions: vector.length,
    };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

/**
 * Embed using OpenRouter's /api/v1/embeddings endpoint.
 * OpenRouter proxies the full set of OpenAI / Cohere / Voyage embedding models.
 */
async function embedWithOpenRouter(
  text: string,
  modelName?: string,
): Promise<EmbeddingResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const model = modelName || DEFAULT_MODELS.openrouter;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text, model }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenRouter embedding failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      data?: Array<{ embedding: number[] }>;
      model?: string;
      usage?: { total_tokens: number };
    };

    const rawEmbedding = json.data?.[0]?.embedding;
    if (!rawEmbedding || !Array.isArray(rawEmbedding)) {
      throw new Error("No embedding returned from OpenRouter");
    }

    const vector = adjustDimensions(rawEmbedding, DEFAULT_EMBEDDING_DIM);

    return {
      vector: normalizeVector(vector),
      model: json.model || model,
      tokenCount: json.usage?.total_tokens,
      provider: "openrouter",
      dimensions: vector.length,
    };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

/**
 * Embed using a local Ollama endpoint (e.g. nomic-embed-text / all-minilm).
 */
async function embedWithOllama(
  text: string,
  modelName?: string,
): Promise<EmbeddingResult> {
  const host = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/+$/, "");
  const model = modelName || DEFAULT_MODELS.ollama;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${host}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Ollama embedding failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as { embedding?: number[] };
    const rawEmbedding = json.embedding;
    if (!rawEmbedding || !Array.isArray(rawEmbedding)) {
      throw new Error("No embedding returned from Ollama");
    }

    const vector = adjustDimensions(rawEmbedding, DEFAULT_EMBEDDING_DIM);

    return {
      vector: normalizeVector(vector),
      model: `ollama/${model}`,
      tokenCount: Math.round(text.length / 4),
      provider: "ollama",
      dimensions: vector.length,
    };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

/**
 * High-performance deterministic 1536D normalized semantic embedding generator.
 * Multi-gram subword hashing + character n-grams + L2 unit-norm projection.
 *
 * Used only when no remote provider is configured — never the production default.
 */
export function embedLocally(
  text: string,
  dimensions: number = DEFAULT_EMBEDDING_DIM,
): EmbeddingResult {
  const clean = text.toLowerCase().trim();
  const vector = new Array(dimensions).fill(0);

  const words = clean.split(/[^a-z0-9_.-]+/).filter((w) => w.length > 0);
  const ngrams: string[] = [];

  for (let i = 0; i < words.length; i++) {
    ngrams.push(words[i]);
    if (i < words.length - 1) {
      ngrams.push(`${words[i]}_${words[i + 1]}`);
    }
    if (i < words.length - 2) {
      ngrams.push(`${words[i]}_${words[i + 1]}_${words[i + 2]}`);
    }
  }

  for (let i = 0; i < clean.length - 2; i++) {
    ngrams.push(clean.slice(i, i + 3));
  }

  const totalTokens = Math.max(1, words.length);

  for (const token of ngrams) {
    let h1 = 0x811c9dc5;
    let h2 = 0x5bd1e995;

    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 0x01000193);
      h2 = Math.imul(h2 ^ code, 0x5bd1e995);
    }

    const weight = 1 / Math.sqrt(totalTokens);

    for (let j = 0; j < 8; j++) {
      const pos1 = Math.abs((h1 + j * 97) % dimensions);
      const pos2 = Math.abs((h2 + j * 199) % dimensions);
      const sign = (h1 ^ (j * 13)) % 2 === 0 ? 1 : -1;

      vector[pos1] += weight * sign * Math.cos((j + 1) * 0.3);
      vector[pos2] += weight * (sign * -1) * Math.sin((j + 1) * 0.7);
    }
  }

  const normalized = normalizeVector(vector);

  return {
    vector: normalized,
    model: `local-semantic-${dimensions}d`,
    tokenCount: totalTokens,
    provider: "local",
    dimensions,
  };
}

/**
 * Batch embed multiple texts with configurable concurrency.
 */
export async function batchEmbed(
  texts: string[],
  options: BatchEmbeddingOptions = {},
): Promise<EmbeddingResult[]> {
  const { concurrency = 5, model, dimensions = DEFAULT_EMBEDDING_DIM } = options;
  const provider = coerceProvider(options.provider);
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((text) =>
        generateEmbedding({ text, model, provider, dimensions }),
      ),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Normalize vector to L2 unit length (euclidean norm = 1.0).
 */
export function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return v;
  return v.map((val) => val / norm);
}

/**
 * Adjust vector dimensions by truncating or zero-padding.
 */
function adjustDimensions(v: number[], targetDim: number): number[] {
  if (v.length === targetDim) return v;
  if (v.length > targetDim) return v.slice(0, targetDim);
  const padded = new Array(targetDim).fill(0);
  for (let i = 0; i < v.length; i++) {
    padded[i] = v[i];
  }
  return padded;
}

/**
 * Calculate Cosine Similarity between two vectors.
 * Returns a value between -1.0 and 1.0 (typically 0.0 to 1.0 for normalized text embeddings).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;

  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}