/**
 * Embedding Service — generates vector embeddings for RAG pipeline.
 *
 * Supports multiple embedding providers:
 * - Groq (free tier available)
 * - OpenAI
 * - Local fallback (TF-IDF style)
 */

export interface EmbeddingOptions {
  /** Text to embed */
  text: string;
  /** Model to use (provider-specific) */
  model?: string;
  /** Provider override */
  provider?: "groq" | "openai" | "local";
}

export interface EmbeddingResult {
  /** The embedding vector */
  vector: number[];
  /** Model used */
  model: string;
  /** Token count (if available) */
  tokenCount?: number;
  /** Provider used */
  provider: string;
}

/**
 * Generate embedding vector for text using the configured provider.
 * Falls back to local TF-IDF style embedding if no API key is available.
 */
export async function generateEmbedding(options: EmbeddingOptions): Promise<EmbeddingResult> {
  const { text, model, provider } = options;

  if (!text.trim()) {
    throw new Error("Cannot embed empty text");
  }

  // Try providers in order of preference
  if (provider === "groq" || (!provider && process.env.GROQ_API_KEY)) {
    try {
      return await embedWithGroq(text, model);
    } catch (error) {
      console.warn("Groq embedding failed, trying fallback:", error);
    }
  }

  if (provider === "openai" || (!provider && process.env.OPENAI_API_KEY)) {
    try {
      return await embedWithOpenAI(text, model);
    } catch (error) {
      console.warn("OpenAI embedding failed, trying fallback:", error);
    }
  }

  // Local fallback — deterministic TF-IDF style embedding
  return embedLocally(text);
}

/**
 * Embed using Groq API (free tier available).
 * Uses the llama-3.3-70b model for embeddings.
 */
async function embedWithGroq(text: string, model?: string): Promise<EmbeddingResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: model || "llama-3.3-70b-versatile",
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq embedding failed ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json() as {
      data?: Array<{ embedding: number[] }>;
      model?: string;
      usage?: { total_tokens: number };
    };

    const embedding = json.data?.[0]?.embedding;
    if (!embedding) throw new Error("No embedding returned from Groq");

    return {
      vector: embedding,
      model: json.model || "llama-3.3-70b-versatile",
      tokenCount: json.usage?.total_tokens,
      provider: "groq",
    };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

/**
 * Embed using OpenAI API.
 * Uses the text-embedding-3-small model for cost efficiency.
 */
async function embedWithOpenAI(text: string, model?: string): Promise<EmbeddingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: model || "text-embedding-3-small",
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI embedding failed ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json() as {
      data?: Array<{ embedding: number[] }>;
      model?: string;
      usage?: { total_tokens: number };
    };

    const embedding = json.data?.[0]?.embedding;
    if (!embedding) throw new Error("No embedding returned from OpenAI");

    return {
      vector: embedding,
      model: json.model || "text-embedding-3-small",
      tokenCount: json.usage?.total_tokens,
      provider: "openai",
    };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

/**
 * Local fallback embedding using TF-IDF style feature extraction.
 * Produces a deterministic 384-dimensional vector from text.
 * Not as good as neural embeddings, but works without API keys.
 */
function embedLocally(text: string): EmbeddingResult {
  const tokens = text.toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 2);

  // Simple hash-based embedding (384 dimensions)
  const vector = new Array(384).fill(0);

  for (const token of tokens) {
    // Hash token to multiple positions
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    }

    // Use hash to set multiple positions
    for (let i = 0; i < 8; i++) {
      const pos = Math.abs((hash + i * 137) % 384);
      vector[pos] += 1 / Math.sqrt(tokens.length);
    }
  }

  // Normalize the vector
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return {
    vector,
    model: "local-tfidf-384d",
    tokenCount: tokens.length,
    provider: "local",
  };
}

/**
 * Batch embed multiple texts.
 * Uses parallel processing with concurrency limit.
 */
export async function batchEmbed(
  texts: string[],
  options: { concurrency?: number; model?: string; provider?: "groq" | "openai" | "local" } = {}
): Promise<EmbeddingResult[]> {
  const { concurrency = 5, model, provider } = options;
  const results: EmbeddingResult[] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding({ text, model, provider }))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Calculate cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
