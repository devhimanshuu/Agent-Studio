import { env } from "@/lib/config/env";
import {
  ALL_MODELS_CATALOG,
  GROQ_ALL_MODELS,
  OPENROUTER_CHAT_MODELS,
  ModelCategory,
  ModelEntry,
  getFreeModelsByCategory,
} from "./modelLists";

interface CachedModels {
  models: ModelEntry[];
  byCategory: Record<string, ModelEntry[]>;
  byProvider: Record<string, ModelEntry[]>;
  groqCount: number;
  openRouterCount: number;
  openaiCount: number;
  totalCount: number;
  fetchedAt: number;
}

let cachedData: CachedModels | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Heuristically categorizes a model based on model ID, name, and modality description.
 */
function inferModelCategory(id: string, name = "", description = "", modality = ""): ModelCategory {
  const lower = `${id} ${name} ${description} ${modality}`.toLowerCase();

  if (lower.includes("guard") || lower.includes("safety") || lower.includes("moderation") || lower.includes("prompt-guard")) {
    return "safety";
  }
  if (lower.includes("embed") || lower.includes("embedding") || lower.includes("vector")) {
    return "embedding";
  }
  if (lower.includes("whisper") || lower.includes("tts") || lower.includes("stt") || lower.includes("voice") || lower.includes("audio") || lower.includes("speech")) {
    return "audio";
  }
  if (lower.includes("vl") || lower.includes("vision") || lower.includes("image") || lower.includes("multimodal") || lower.includes("ocr")) {
    return "vision";
  }
  if (lower.includes("code") || lower.includes("coder") || lower.includes("coding") || lower.includes("qwen-2.5-coder") || lower.includes("starcoder")) {
    return "code";
  }
  if (
    lower.includes("reasoning") ||
    lower.includes("deepseek-r1") ||
    lower.includes("o1") ||
    lower.includes("o3") ||
    lower.includes("compound") ||
    lower.includes("nemotron-3-super") ||
    lower.includes("nemotron-3-ultra") ||
    lower.includes("gpt-oss-120b")
  ) {
    return "reasoning";
  }
  if (lower.includes("router") || lower.includes("auto-router")) {
    return "router";
  }
  return "general";
}

/**
 * Formats a clean human-readable label from a model ID
 */
function formatModelLabel(id: string, rawName?: string): string {
  if (rawName && rawName.trim().length > 0) {
    return rawName.trim();
  }
  const parts = id.split("/");
  const modelName = parts[parts.length - 1] || id;
  return modelName
    .split(/[-_:]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Fetch live models from Groq API (https://api.groq.com/openai/v1/models)
 */
export async function fetchLiveGroqModels(apiKey?: string): Promise<ModelEntry[]> {
  const effectiveKey = apiKey || env.GROQ_API_KEY;
  if (!effectiveKey) {
    return GROQ_ALL_MODELS;
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn(`[Groq Models API] HTTP ${res.status}: ${res.statusText}, using fallback catalog`);
      return GROQ_ALL_MODELS;
    }

    const json = await res.json();
    const data = (json?.data as Array<{ id: string; active?: boolean; context_window?: number }>) || [];

    if (!Array.isArray(data) || data.length === 0) {
      return GROQ_ALL_MODELS;
    }

    const activeList = data.filter((m) => m.active !== false);

    return activeList.map((m) => {
      const known = GROQ_ALL_MODELS.find((k) => k.model === m.id);
      return {
        provider: "groq",
        model: m.id,
        label: known?.label || formatModelLabel(m.id),
        category: known?.category || inferModelCategory(m.id),
        contextLength: m.context_window || known?.contextLength || 131072,
        throughput: known?.throughput || "Fast LPU",
        latency: known?.latency,
        inputPrice: 0,
        outputPrice: 0,
      };
    });
  } catch (err) {
    console.warn("[Groq Models API] Failed to fetch live models, using fallback catalog:", err instanceof Error ? err.message : String(err));
    return GROQ_ALL_MODELS;
  }
}

/**
 * Fetch live models from OpenRouter API (https://openrouter.ai/api/v1/models)
 */
export async function fetchLiveOpenRouterModels(apiKey?: string): Promise<ModelEntry[]> {
  const effectiveKey = apiKey || env.OPENROUTER_API_KEY;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (effectiveKey) {
      headers["Authorization"] = `Bearer ${effectiveKey}`;
    }

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[OpenRouter Models API] HTTP ${res.status}: ${res.statusText}, using fallback catalog`);
      return OPENROUTER_CHAT_MODELS;
    }

    const json = await res.json();
    const data = (json?.data as Array<{
      id: string;
      name?: string;
      description?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
      architecture?: { modality?: string; instruct_type?: string };
      top_provider?: { is_moderated?: boolean };
    }>) || [];

    if (!Array.isArray(data) || data.length === 0) {
      return OPENROUTER_CHAT_MODELS;
    }

    // Include all free models (:free suffix or zero price) and paid models with live pricing
    const parsedModels: ModelEntry[] = data.map((m) => {
      const known = ALL_MODELS_CATALOG.find((k) => k.model === m.id);
      const promptCost = m.pricing?.prompt != null ? parseFloat(String(m.pricing.prompt)) : 0;
      const completionCost = m.pricing?.completion != null ? parseFloat(String(m.pricing.completion)) : 0;
      const isFree = m.id.endsWith(":free") || (promptCost === 0 && completionCost === 0);
      const category = known?.category || inferModelCategory(m.id, m.name, m.description, m.architecture?.modality);

      return {
        provider: "openrouter",
        model: m.id,
        label: known?.label || formatModelLabel(m.id, m.name),
        category,
        contextLength: m.context_length || known?.contextLength || 128000,
        inputPrice: isFree ? 0 : promptCost,
        outputPrice: isFree ? 0 : completionCost,
        latency: known?.latency,
        throughput: known?.throughput,
      };
    });

    // Auto-Router entry at top
    const autoRouterEntry: ModelEntry = {
      provider: "openrouter",
      model: "openrouter/free",
      label: "OpenRouter: Free Models Auto-Router",
      category: "router",
      contextLength: 262144,
      inputPrice: 0,
      outputPrice: 0,
    };

    // Prioritize free models, then paid models with accurate pricing
    const freeModels = parsedModels.filter(
      (m) => m.model !== "openrouter/free" && (m.model.endsWith(":free") || ((m.inputPrice ?? 0) === 0 && (m.outputPrice ?? 0) === 0))
    );
    const paidModels = parsedModels.filter(
      (m) => m.model !== "openrouter/free" && !m.model.endsWith(":free") && ((m.inputPrice ?? 0) > 0 || (m.outputPrice ?? 0) > 0)
    );

    return [autoRouterEntry, ...freeModels, ...paidModels];
  } catch (err) {
    console.warn("[OpenRouter Models API] Failed to fetch live models, using fallback catalog:", err instanceof Error ? err.message : String(err));
    return OPENROUTER_CHAT_MODELS;
  }
}

/**
 * Fetch live models from OpenAI API (https://api.openai.com/v1/models) if key configured
 */
export async function fetchLiveOpenAIModels(apiKey?: string): Promise<ModelEntry[]> {
  const effectiveKey = apiKey || env.OPENAI_API_KEY;
  if (!effectiveKey) return [];

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const json = await res.json();
    const data = (json?.data as Array<{ id: string; owned_by?: string }>) || [];

    const chatModels = data.filter((m) =>
      m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3") || m.id.startsWith("chatgpt-")
    );

    return chatModels.map((m) => ({
      provider: "openai",
      model: m.id,
      label: `OpenAI: ${formatModelLabel(m.id)}`,
      category: inferModelCategory(m.id),
      contextLength: m.id.includes("128k") ? 128000 : 131072,
    }));
  } catch {
    return [];
  }
}

/**
 * Aggregates all provider models dynamically with in-memory caching.
 */
export async function getLiveProviderModels(forceRefresh = false): Promise<{
  models: ModelEntry[];
  byCategory: Record<string, ModelEntry[]>;
  byProvider: Record<string, ModelEntry[]>;
  groqCount: number;
  openRouterCount: number;
  openaiCount: number;
  totalCount: number;
  liveFetched: boolean;
}> {
  const now = Date.now();
  if (!forceRefresh && cachedData && now - cachedData.fetchedAt < CACHE_TTL_MS) {
    return {
      ...cachedData,
      liveFetched: false,
    };
  }

  const [groqModels, openRouterModels, openaiModels] = await Promise.all([
    fetchLiveGroqModels(),
    fetchLiveOpenRouterModels(),
    fetchLiveOpenAIModels(),
  ]);

  const allModels: ModelEntry[] = [
    ...groqModels,
    ...openRouterModels,
    ...openaiModels,
  ];

  // Group by category
  const byCategory: Record<string, ModelEntry[]> = {
    all: allModels,
    general: [],
    reasoning: [],
    code: [],
    vision: [],
    embedding: [],
    safety: [],
    audio: [],
    router: [],
  };

  for (const m of allModels) {
    const cat = m.category || "general";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(m);
  }

  // Ensure fallback items exist for specialized categories if providers didn't return them
  const fallbackByCat = getFreeModelsByCategory();
  for (const cat of Object.keys(fallbackByCat)) {
    if (!byCategory[cat] || byCategory[cat].length === 0) {
      byCategory[cat] = fallbackByCat[cat] || [];
    }
  }

  const byProvider: Record<string, ModelEntry[]> = {
    groq: groqModels,
    openrouter: openRouterModels,
    openai: openaiModels,
  };

  cachedData = {
    models: allModels,
    byCategory,
    byProvider,
    groqCount: groqModels.length,
    openRouterCount: openRouterModels.length,
    openaiCount: openaiModels.length,
    totalCount: allModels.length,
    fetchedAt: now,
  };

  return {
    ...cachedData,
    liveFetched: true,
  };
}
