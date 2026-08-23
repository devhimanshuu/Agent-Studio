/**
 * Model rosters for the failover router and multi-agent execution engine.
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
  /** Capability specialization */
  category?: "code" | "general" | "reasoning" | "vision" | "embedding" | "safety" | "audio" | "router";
  /** Context window in tokens */
  contextLength?: number;
  /** Input cost ($0 for free) */
  inputPrice?: number;
  /** Output cost ($0 for free) */
  outputPrice?: number;
  /** Throughput / speed description */
  throughput?: string;
  /** Typical latency */
  latency?: string;
}

/** Every free-tier model on the Groq API, best-first. All support tool/function calling. */
export const GROQ_FREE_MODELS: ModelEntry[] = [
  { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", category: "general", contextLength: 131072, throughput: "280 t/s" },
  { provider: "groq", model: "openai/gpt-oss-120b", label: "GPT-OSS 120B", category: "general", contextLength: 131072, throughput: "240 t/s" },
  { provider: "groq", model: "qwen/qwen3.6-27b", label: "Qwen 3.6 27B", category: "general", contextLength: 131072, throughput: "350 t/s" },
  { provider: "groq", model: "openai/gpt-oss-20b", label: "GPT-OSS 20B", category: "general", contextLength: 131072, throughput: "420 t/s" },
  { provider: "groq", model: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", category: "general", contextLength: 131072, throughput: "750 t/s" },
];

/**
 * OpenRouter free models (`:free` suffix) curated for agentic, tool-calling,
 * code generation, reasoning, embeddings, and voice/audio workloads.
 */
export const OPENROUTER_FREE_MODELS: ModelEntry[] = [
  // High-Capacity Reasoning & Flagship Multi-Agent Engines
  { provider: "openrouter", model: "openrouter/free", label: "OpenRouter: Free Models Auto-Router", category: "router", contextLength: 262144 },
  { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free", label: "NVIDIA: Nemotron 3 Super 120B", category: "reasoning", contextLength: 262144, throughput: "45 t/s" },
  { provider: "openrouter", model: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "NVIDIA: Nemotron 3 Ultra 550B", category: "reasoning", contextLength: 262144, throughput: "28 t/s" },
  { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free", label: "Meta: Llama 3.3 70B Instruct", category: "general", contextLength: 131072, throughput: "40 t/s" },
  { provider: "openrouter", model: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek: Chat V3", category: "general", contextLength: 65536, throughput: "35 t/s" },
  { provider: "openrouter", model: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen: 2.5 72B Instruct", category: "general", contextLength: 131072, throughput: "38 t/s" },

  // Coding & Technical Specialization
  { provider: "openrouter", model: "cohere/north-mini-code:free", label: "Cohere: North Mini Code", category: "code", contextLength: 256000, latency: "1250ms", throughput: "25 t/s" },
  { provider: "openrouter", model: "poolside/laguna-xs-2.1:free", label: "Poolside: Laguna XS 2.1", category: "general", contextLength: 262144, latency: "696ms", throughput: "55 t/s" },
  { provider: "openrouter", model: "dots-studio/dots-3-note-preview:free", label: "Dots Studio: Dots3-Note Preview", category: "general", contextLength: 512000, latency: "898ms", throughput: "66 t/s" },

  // NVIDIA Nemotron & Reasoning Family
  { provider: "openrouter", model: "nvidia/nemotron-3-nano-30b-a3b:free", label: "NVIDIA: Nemotron 3 Nano 30B A3B", category: "general", contextLength: 256000, latency: "845ms", throughput: "87 t/s" },
  { provider: "openrouter", model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "NVIDIA: Nemotron 3 Nano Omni", category: "reasoning", contextLength: 256000, latency: "415ms", throughput: "61 t/s" },
  { provider: "openrouter", model: "nvidia/nemotron-nano-9b-v2:free", label: "NVIDIA: Nemotron Nano 9B V2", category: "general", contextLength: 128000, latency: "988ms", throughput: "38 t/s" },
  { provider: "openrouter", model: "nvidia/nemotron-nano-12b-v2-vl:free", label: "NVIDIA: Nemotron Nano 12B 2 VL", category: "vision", contextLength: 128000, latency: "1809ms", throughput: "19 t/s" },
  { provider: "openrouter", model: "nvidia/nemotron-3.5-content-safety:free", label: "NVIDIA: Nemotron 3.5 Content Safety", category: "safety", contextLength: 128000, latency: "256ms", throughput: "65 t/s" },
  { provider: "openrouter", model: "nvidia/nemotron-3-embed-1b:free", label: "NVIDIA: Nemotron 3 Embed 1B", category: "embedding", contextLength: 32768 },
  { provider: "openrouter", model: "nvidia/llama-nemotron-embed-vl-1b-v2:free", label: "NVIDIA: Llama Nemotron Embed VL 1B V2", category: "embedding", contextLength: 131072 },
  { provider: "openrouter", model: "nvidia/llama-nemotron-rerank-vl-1b-v2:free", label: "NVIDIA: Llama Nemotron Rerank VL 1B V2", category: "vision", contextLength: 10240 },

  // Thinking Machines Family
  { provider: "openrouter", model: "thinkingmachines/inkling:free", label: "Thinking Machines: Inkling", category: "general", contextLength: 262144, latency: "1134ms", throughput: "62 t/s" },
  { provider: "openrouter", model: "thinkingmachines/inkling-small:free", label: "Thinking Machines: Inkling Small", category: "general", contextLength: 262144, latency: "921ms", throughput: "100 t/s" },

  // Z.ai Ultra-High Speed GLM
  { provider: "openrouter", model: "z-ai/glm-5.2:free", label: "Z.ai: GLM 5.2", category: "general", contextLength: 256000, latency: "3297ms", throughput: "168 t/s" },

  // Google Gemma 4 Series
  { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free", label: "Google: Gemma 4 26B A4B", category: "general", contextLength: 262144, latency: "936ms", throughput: "39 t/s" },
  { provider: "openrouter", model: "google/gemma-4-31b-it:free", label: "Google: Gemma 4 31B", category: "general", contextLength: 262144, latency: "1243ms", throughput: "24 t/s" },

  // LiquidAI Edge & High-Throughput Models
  { provider: "openrouter", model: "liquid/lfm-2.5-2.6b:free", label: "LiquidAI: LFM2.5-2.6B", category: "general", contextLength: 65536, latency: "2093ms", throughput: "210 t/s" },
  { provider: "openrouter", model: "liquid/lfm-2.5-embedding-350m:free", label: "LiquidAI: LFM2.5-Embedding-350M", category: "embedding", contextLength: 512 },

  // Stealth AI
  { provider: "openrouter", model: "stealth/ox-alpha:free", label: "Stealth: OX Alpha", category: "reasoning", contextLength: 131072 },
  { provider: "openrouter", model: "stealth/ox-alpha", label: "Stealth: OX Alpha (Direct)", category: "reasoning", contextLength: 131072 },

  // Free Audio, TTS & Speech Synthesis
  { provider: "openrouter", model: "fish-audio/s2.1-pro-free:free", label: "Fish Audio: S2.1 Pro Free", category: "audio" },
  { provider: "openrouter", model: "deepgram/flux-tts:free", label: "Deepgram: Flux TTS", category: "audio" },
];

/** Combined list used by the failover router factory. OpenRouter free auto-router first, then Groq, then specific OpenRouter models. */
export const ALL_FALLBACK_MODELS: ModelEntry[] = [
  { provider: "openrouter", model: "openrouter/free", label: "OpenRouter: Free Models Auto-Router", category: "router", contextLength: 262144 },
  ...GROQ_FREE_MODELS,
  ...OPENROUTER_FREE_MODELS.filter((m) => m.model !== "openrouter/free"),
];

/** Lookup a free model entry by ID */
export function findModelEntry(modelId: string): ModelEntry | undefined {
  return ALL_FALLBACK_MODELS.find((m) => m.model === modelId || m.model.split(":")[0] === modelId);
}

/** Get all free models grouped by category */
export function getFreeModelsByCategory(): Record<string, ModelEntry[]> {
  const groups: Record<string, ModelEntry[]> = {
    all: ALL_FALLBACK_MODELS,
    reasoning: [],
    code: [],
    general: [],
    vision: [],
    embedding: [],
    safety: [],
    audio: [],
    router: [],
  };

  for (const m of ALL_FALLBACK_MODELS) {
    const cat = m.category || "general";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(m);
  }

  return groups;
}
