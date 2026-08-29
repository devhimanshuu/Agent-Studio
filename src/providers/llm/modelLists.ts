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
  /** Vendor used by the router factory: "groq" | "openrouter" | "openai" | "custom_openai" | string. */
  provider: "groq" | "openrouter" | "openai" | "custom_openai" | string;
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

/**
 * Every free-tier chat & reasoning model on the Groq API, best-first.
 * All support ultra-fast inference with tool/function calling on LPU hardware.
 */
export const GROQ_FREE_MODELS: ModelEntry[] = [
  { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", category: "general", contextLength: 131072, throughput: "280 t/s" },
  { provider: "groq", model: "openai/gpt-oss-120b", label: "OpenAI: GPT-OSS 120B", category: "reasoning", contextLength: 131072, throughput: "240 t/s" },
  { provider: "groq", model: "groq/compound", label: "Groq: Compound AI System", category: "reasoning", contextLength: 131072, throughput: "450 t/s" },
  { provider: "groq", model: "groq/compound-mini", label: "Groq: Compound Mini", category: "reasoning", contextLength: 131072, throughput: "600 t/s" },
  { provider: "groq", model: "qwen/qwen3.6-27b", label: "Qwen: 3.6 27B", category: "code", contextLength: 131072, throughput: "350 t/s" },
  { provider: "groq", model: "openai/gpt-oss-20b", label: "OpenAI: GPT-OSS 20B", category: "general", contextLength: 131072, throughput: "420 t/s" },
  { provider: "groq", model: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", category: "general", contextLength: 131072, throughput: "750 t/s" },
];

/** Dedicated Groq Safety & Guardrail Models */
export const GROQ_SAFETY_MODELS: ModelEntry[] = [
  { provider: "groq", model: "meta-llama/llama-prompt-guard-2-86m", label: "Meta: Llama Prompt Guard 2 86M", category: "safety", contextLength: 8192, throughput: "1200 t/s" },
  { provider: "groq", model: "meta-llama/llama-prompt-guard-2-22m", label: "Meta: Llama Prompt Guard 2 22M", category: "safety", contextLength: 8192, throughput: "1500 t/s" },
  { provider: "groq", model: "openai/gpt-oss-safeguard-20b", label: "OpenAI: GPT-OSS Safeguard 20B", category: "safety", contextLength: 131072, throughput: "450 t/s" },
];

/** Dedicated Groq Voice, Audio & Speech Models */
export const GROQ_AUDIO_MODELS: ModelEntry[] = [
  { provider: "groq", model: "canopylabs/orpheus-v1-english", label: "CanopyLabs: Orpheus V1 English (Voice)", category: "audio", contextLength: 4096 },
  { provider: "groq", model: "canopylabs/orpheus-arabic-saudi", label: "CanopyLabs: Orpheus Arabic Saudi (Voice)", category: "audio", contextLength: 4096 },
  { provider: "groq", model: "whisper-large-v3-turbo", label: "Whisper: Large V3 Turbo (STT)", category: "audio", throughput: "1800 t/s" },
  { provider: "groq", model: "whisper-large-v3", label: "Whisper: Large V3 (STT)", category: "audio", throughput: "1200 t/s" },
];

/** Complete Groq Model Roster */
export const GROQ_ALL_MODELS: ModelEntry[] = [
  ...GROQ_FREE_MODELS,
  ...GROQ_SAFETY_MODELS,
  ...GROQ_AUDIO_MODELS,
];

/**
 * OpenRouter free chat & reasoning models (`:free` suffix) capable of standard
 * /chat/completions for agent reasoning, planning, coding, and routing.
 */
export const OPENROUTER_CHAT_MODELS: ModelEntry[] = [
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
  { provider: "openrouter", model: "nvidia/nemotron-nano-12b-v2-vl:free", label: "NVIDIA: Nemotron Nano 12B 2 VL (Vision)", category: "vision", contextLength: 128000, latency: "1809ms", throughput: "19 t/s" },

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

  // Stealth AI
  { provider: "openrouter", model: "stealth/ox-alpha:free", label: "Stealth: OX Alpha", category: "reasoning", contextLength: 131072 },
  { provider: "openrouter", model: "stealth/ox-alpha", label: "Stealth: OX Alpha (Direct)", category: "reasoning", contextLength: 131072 },
];

/** Alias for backwards compatibility with existing openrouter chat roster imports */
export const OPENROUTER_FREE_MODELS = OPENROUTER_CHAT_MODELS;

/** Dedicated Dense Vector Embedding Models (for Qdrant, Pinecone, RAG & Semantic Memory) */
export const EMBEDDING_MODELS: ModelEntry[] = [
  { provider: "openrouter", model: "nvidia/nemotron-3-embed-1b:free", label: "NVIDIA: Nemotron 3 Embed 1B", category: "embedding", contextLength: 32768 },
  { provider: "openrouter", model: "nvidia/llama-nemotron-embed-vl-1b-v2:free", label: "NVIDIA: Llama Nemotron Embed VL 1B V2", category: "embedding", contextLength: 131072 },
  { provider: "openrouter", model: "liquid/lfm-2.5-embedding-350m:free", label: "LiquidAI: LFM2.5-Embedding-350M", category: "embedding", contextLength: 512 },
];

/** Dedicated Voice, Audio & Speech Models (for Audio Transcriber STT & Piper / Neural TTS) */
export const AUDIO_MODELS: ModelEntry[] = [
  ...GROQ_AUDIO_MODELS,
  { provider: "openrouter", model: "fish-audio/s2.1-pro-free:free", label: "Fish Audio: S2.1 Pro Free (Voice Synthesis)", category: "audio" },
  { provider: "openrouter", model: "deepgram/flux-tts:free", label: "Deepgram: Flux TTS (Neural Voice)", category: "audio" },
];

/** Dedicated Vision & Multimodal OCR Models */
export const VISION_MODELS: ModelEntry[] = [
  { provider: "openrouter", model: "nvidia/nemotron-nano-12b-v2-vl:free", label: "NVIDIA: Nemotron Nano 12B 2 VL", category: "vision", contextLength: 128000, latency: "1809ms", throughput: "19 t/s" },
  { provider: "openrouter", model: "nvidia/llama-nemotron-rerank-vl-1b-v2:free", label: "NVIDIA: Llama Nemotron Rerank VL 1B V2", category: "vision", contextLength: 10240 },
];

/** Dedicated Safety & Content Moderation Models */
export const SAFETY_MODELS: ModelEntry[] = [
  ...GROQ_SAFETY_MODELS,
  { provider: "openrouter", model: "nvidia/nemotron-3.5-content-safety:free", label: "NVIDIA: Nemotron 3.5 Content Safety", category: "safety", contextLength: 128000, latency: "256ms", throughput: "65 t/s" },
];

/**
 * Combined list of CHAT & REASONING models used by the failover router factory.
 * Groq free models are tried first, then OpenRouter chat models.
 * Non-chat models (pure embeddings, audio synthesis) are excluded from the chat failover router.
 */
export const ALL_FALLBACK_MODELS: ModelEntry[] = [
  ...GROQ_FREE_MODELS,
  ...OPENROUTER_CHAT_MODELS,
];

/** Complete catalog of all supported models across all modalities */
export const ALL_MODELS_CATALOG: ModelEntry[] = [
  ...GROQ_ALL_MODELS,
  ...OPENROUTER_CHAT_MODELS,
  ...EMBEDDING_MODELS,
  ...AUDIO_MODELS.filter((a) => !GROQ_AUDIO_MODELS.some((g) => g.model === a.model)),
  ...VISION_MODELS.filter((v) => !OPENROUTER_CHAT_MODELS.some((m) => m.model === v.model)),
  ...SAFETY_MODELS.filter((s) => !GROQ_SAFETY_MODELS.some((g) => g.model === s.model)),
];

export type ModelCategory =
  | "general"
  | "reasoning"
  | "code"
  | "vision"
  | "embedding"
  | "safety"
  | "audio"
  | "router";

/**
 * Category-specific fallback chains.
 * When an agent performs a specialized task (e.g. reasoning, coding, safety, audio, embeddings, vision),
 * the router tries specialized models first, then falls back to resilient alternative models.
 */
export const CATEGORY_FALLBACK_MODELS: Record<ModelCategory, ModelEntry[]> = {
  // 1. General chat / orchestrator failover chain
  general: ALL_FALLBACK_MODELS,

  // 2. Heavy reasoning & multi-agent synthesis failover chain
  reasoning: [
    { provider: "groq", model: "openai/gpt-oss-120b", label: "OpenAI: GPT-OSS 120B", category: "reasoning", contextLength: 131072, throughput: "240 t/s" },
    { provider: "groq", model: "groq/compound", label: "Groq: Compound AI System", category: "reasoning", contextLength: 131072, throughput: "450 t/s" },
    { provider: "groq", model: "groq/compound-mini", label: "Groq: Compound Mini", category: "reasoning", contextLength: 131072, throughput: "600 t/s" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free", label: "NVIDIA: Nemotron 3 Super 120B", category: "reasoning", contextLength: 262144, throughput: "45 t/s" },
    { provider: "openrouter", model: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "NVIDIA: Nemotron 3 Ultra 550B", category: "reasoning", contextLength: 262144, throughput: "28 t/s" },
    { provider: "openrouter", model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "NVIDIA: Nemotron 3 Nano Omni", category: "reasoning", contextLength: 256000, latency: "415ms", throughput: "61 t/s" },
    { provider: "openrouter", model: "stealth/ox-alpha:free", label: "Stealth: OX Alpha", category: "reasoning", contextLength: 131072 },
    // General fallbacks
    { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", category: "general", contextLength: 131072, throughput: "280 t/s" },
    { provider: "openrouter", model: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek: Chat V3", category: "general", contextLength: 65536, throughput: "35 t/s" },
  ],

  // 3. Coding & technical specialization failover chain
  code: [
    { provider: "groq", model: "qwen/qwen3.6-27b", label: "Qwen: 3.6 27B", category: "code", contextLength: 131072, throughput: "350 t/s" },
    { provider: "openrouter", model: "cohere/north-mini-code:free", label: "Cohere: North Mini Code", category: "code", contextLength: 256000, latency: "1250ms", throughput: "25 t/s" },
    { provider: "openrouter", model: "poolside/laguna-xs-2.1:free", label: "Poolside: Laguna XS 2.1", category: "general", contextLength: 262144, latency: "696ms", throughput: "55 t/s" },
    { provider: "openrouter", model: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen: 2.5 72B Instruct", category: "general", contextLength: 131072, throughput: "38 t/s" },
    { provider: "openrouter", model: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek: Chat V3", category: "general", contextLength: 65536, throughput: "35 t/s" },
    { provider: "groq", model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", category: "general", contextLength: 131072, throughput: "280 t/s" },
  ],

  // 4. Safety & guardrail moderation failover chain
  safety: [
    { provider: "groq", model: "meta-llama/llama-prompt-guard-2-86m", label: "Meta: Llama Prompt Guard 2 86M", category: "safety", contextLength: 8192, throughput: "1200 t/s" },
    { provider: "groq", model: "meta-llama/llama-prompt-guard-2-22m", label: "Meta: Llama Prompt Guard 2 22M", category: "safety", contextLength: 8192, throughput: "1500 t/s" },
    { provider: "groq", model: "openai/gpt-oss-safeguard-20b", label: "OpenAI: GPT-OSS Safeguard 20B", category: "safety", contextLength: 131072, throughput: "450 t/s" },
    { provider: "openrouter", model: "nvidia/nemotron-3.5-content-safety:free", label: "NVIDIA: Nemotron 3.5 Content Safety", category: "safety", contextLength: 128000, latency: "256ms", throughput: "65 t/s" },
  ],

  // 5. Voice, speech & audio synthesis / STT failover chain
  audio: [
    { provider: "groq", model: "whisper-large-v3-turbo", label: "Whisper: Large V3 Turbo (STT)", category: "audio", throughput: "1800 t/s" },
    { provider: "groq", model: "whisper-large-v3", label: "Whisper: Large V3 (STT)", category: "audio", throughput: "1200 t/s" },
    { provider: "groq", model: "canopylabs/orpheus-v1-english", label: "CanopyLabs: Orpheus V1 English (Voice)", category: "audio", contextLength: 4096 },
    { provider: "groq", model: "canopylabs/orpheus-arabic-saudi", label: "CanopyLabs: Orpheus Arabic Saudi (Voice)", category: "audio", contextLength: 4096 },
    { provider: "openrouter", model: "deepgram/flux-tts:free", label: "Deepgram: Flux TTS (Neural Voice)", category: "audio" },
    { provider: "openrouter", model: "fish-audio/s2.1-pro-free:free", label: "Fish Audio: S2.1 Pro Free (Voice Synthesis)", category: "audio" },
  ],

  // 6. Dense vector embedding & RAG memory failover chain
  embedding: [
    { provider: "openrouter", model: "nvidia/nemotron-3-embed-1b:free", label: "NVIDIA: Nemotron 3 Embed 1B", category: "embedding", contextLength: 32768 },
    { provider: "openrouter", model: "nvidia/llama-nemotron-embed-vl-1b-v2:free", label: "NVIDIA: Llama Nemotron Embed VL 1B V2", category: "embedding", contextLength: 131072 },
    { provider: "openrouter", model: "liquid/lfm-2.5-embedding-350m:free", label: "LiquidAI: LFM2.5-Embedding-350M", category: "embedding", contextLength: 512 },
  ],

  // 7. Multimodal vision & OCR document parsing failover chain
  vision: [
    { provider: "openrouter", model: "nvidia/nemotron-nano-12b-v2-vl:free", label: "NVIDIA: Nemotron Nano 12B 2 VL (Vision)", category: "vision", contextLength: 128000, latency: "1809ms", throughput: "19 t/s" },
    { provider: "openrouter", model: "nvidia/llama-nemotron-rerank-vl-1b-v2:free", label: "NVIDIA: Llama Nemotron Rerank VL 1B V2", category: "vision", contextLength: 10240 },
    { provider: "groq", model: "groq/compound", label: "Groq: Compound AI System", category: "reasoning", contextLength: 131072, throughput: "450 t/s" },
    { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free", label: "Google: Gemma 4 26B A4B", category: "general", contextLength: 262144, latency: "936ms", throughput: "39 t/s" },
    { provider: "openrouter", model: "google/gemma-4-31b-it:free", label: "Google: Gemma 4 31B", category: "general", contextLength: 262144, latency: "1243ms", throughput: "24 t/s" },
  ],

  // 8. Low-latency AI routing decision failover chain
  router: [
    { provider: "groq", model: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", category: "general", contextLength: 131072, throughput: "750 t/s" },
    { provider: "groq", model: "openai/gpt-oss-20b", label: "OpenAI: GPT-OSS 20B", category: "general", contextLength: 131072, throughput: "420 t/s" },
    { provider: "openrouter", model: "openrouter/free", label: "OpenRouter: Free Models Auto-Router", category: "router", contextLength: 262144 },
    { provider: "openrouter", model: "liquid/lfm-2.5-2.6b:free", label: "LiquidAI: LFM2.5-2.6B", category: "general", contextLength: 65536, latency: "2093ms", throughput: "210 t/s" },
    { provider: "openrouter", model: "z-ai/glm-5.2:free", label: "Z.ai: GLM 5.2", category: "general", contextLength: 256000, latency: "3297ms", throughput: "168 t/s" },
  ],
};

/** Lookup any model entry by ID across all modalities */
export function findModelEntry(modelId: string): ModelEntry | undefined {
  return ALL_MODELS_CATALOG.find((m) => m.model === modelId || m.model.split(":")[0] === modelId);
}

/** Get chat & reasoning models only */
export function getChatModels(): ModelEntry[] {
  return ALL_FALLBACK_MODELS;
}

/** Get vector embedding models only */
export function getEmbeddingModels(): ModelEntry[] {
  return EMBEDDING_MODELS;
}

/** Get voice & audio models only */
export function getAudioModels(): ModelEntry[] {
  return AUDIO_MODELS;
}

/** Get vision / multimodal OCR models only */
export function getVisionModels(): ModelEntry[] {
  return VISION_MODELS;
}

/** Get safety / guardrail models only */
export function getSafetyModels(): ModelEntry[] {
  return SAFETY_MODELS;
}

/** Get fallback chain for a specific category */
export function getCategoryFallbackModels(category: ModelCategory | string): ModelEntry[] {
  const cat = (category in CATEGORY_FALLBACK_MODELS ? category : "general") as ModelCategory;
  return CATEGORY_FALLBACK_MODELS[cat] || ALL_FALLBACK_MODELS;
}

/**
 * Returns an ordered fallback chain for a specific model ID.
 * The requested model sits first, followed by other models in the same capability category,
 * followed by general fallbacks so calls never fail unconditionally.
 */
export function getFallbackChainForModel(modelId: string): ModelEntry[] {
  const entry = findModelEntry(modelId);
  const requestedEntry: ModelEntry = entry || {
    provider: modelId.startsWith("groq/") || modelId.startsWith("canopylabs/") || modelId.startsWith("whisper-") ? "groq" : "openrouter",
    model: modelId,
    label: modelId,
    category: "general",
  };

  const category = requestedEntry.category || "general";
  const categoryModels = getCategoryFallbackModels(category);
  const fallbacks = categoryModels.filter((m) => m.model !== requestedEntry.model);

  return [requestedEntry, ...fallbacks];
}

/** Get all models grouped by category across the entire platform catalog */
export function getFreeModelsByCategory(): Record<string, ModelEntry[]> {
  const groups: Record<string, ModelEntry[]> = {
    all: ALL_MODELS_CATALOG,
    reasoning: [],
    code: [],
    general: [],
    vision: [],
    embedding: [],
    safety: [],
    audio: [],
    router: [],
  };

  for (const m of ALL_MODELS_CATALOG) {
    const cat = m.category || "general";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(m);
  }

  return groups;
}
