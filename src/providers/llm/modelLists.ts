/**
 * Model rosters for the failover router.
 *
 * Ordering matters: the router tries entries from top to bottom, so the most
 * capable model sits first and cheaper/smaller models act as fallbacks.
 * When a model fails it is temporarily parked (circuit-breaker cooldown) and
 * the next entry in the list is tried automatically.
 *
 * NOTE: vendor free-tier rosters rotate. A model that 404s is exactly the
 * failure case the router is built for — it logs, skips, and moves on.
 */

export interface ModelEntry {
  /** Vendor used by the router factory: "groq" | "openrouter". */
  provider: "groq" | "openrouter";
  /** Exact model ID for the chat completions API. */
  model: string;
  /** Human-readable label (for logs/UI). */
  label: string;
}

/** Every free-tier model on the Groq API, best-first. All support tool/function calling. */
export const GROQ_FREE_MODELS: ModelEntry[] = [
  { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
  { provider: "groq", model: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { provider: "groq", model: "qwen/qwen3.6-27b", label: "Qwen 3.6 27B" },
  { provider: "groq", model: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
  { provider: "groq", model: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
];

/**
 * OpenRouter free models (`:free` suffix) curated for agentic, tool-calling
 * workloads — the kind of work Agent Studio skills do. Best-first.
 */
export const OPENROUTER_FREE_MODELS: ModelEntry[] = [
  { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B" },
  { provider: "openrouter", model: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra 550B" },
  { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B Instruct" },
  { provider: "openrouter", model: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek Chat V3" },
  { provider: "openrouter", model: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B Instruct" },
  { provider: "openrouter", model: "cohere/north-mini-code:free", label: "Cohere North Mini Code" },
  { provider: "openrouter", model: "openai/gpt-oss-20b:free", label: "GPT-OSS 20B" },
];

/** Combined list used by the router factory. Groq first, then OpenRouter. */
export const ALL_FALLBACK_MODELS: ModelEntry[] = [...GROQ_FREE_MODELS, ...OPENROUTER_FREE_MODELS];
