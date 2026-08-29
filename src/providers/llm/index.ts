import { LLMProvider } from "./LLMProvider";
import { GroqProvider } from "./GroqProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";
import { CustomOpenAICompatibleProvider } from "./CustomOpenAICompatibleProvider";
import { LLMRouter, LLMRouterOptions } from "./LLMRouter";
import {
  ALL_FALLBACK_MODELS,
  ModelCategory,
  getCategoryFallbackModels,
  getFallbackChainForModel,
} from "./modelLists";
import { env } from "@/lib/config/env";

export type { LLMProvider, LLMChatMessage, LLMCompletionOptions, LLMCompletionResult, LLMStreamChunk, LLMTool, LLMToolCall } from "./LLMProvider";
export { LLMError } from "./LLMProvider";
export { GroqProvider } from "./GroqProvider";
export { OpenRouterProvider } from "./OpenRouterProvider";
export { CustomOpenAICompatibleProvider, type CustomProviderConfig } from "./CustomOpenAICompatibleProvider";
export { LLMRouter, type LLMRouterOptions } from "./LLMRouter";
export {
  GROQ_FREE_MODELS,
  GROQ_SAFETY_MODELS,
  GROQ_AUDIO_MODELS,
  GROQ_ALL_MODELS,
  OPENROUTER_FREE_MODELS,
  OPENROUTER_CHAT_MODELS,
  EMBEDDING_MODELS,
  AUDIO_MODELS,
  VISION_MODELS,
  SAFETY_MODELS,
  ALL_FALLBACK_MODELS,
  ALL_MODELS_CATALOG,
  CATEGORY_FALLBACK_MODELS,
  type ModelCategory,
  findModelEntry,
  getChatModels,
  getEmbeddingModels,
  getAudioModels,
  getVisionModels,
  getSafetyModels,
  getCategoryFallbackModels,
  getFallbackChainForModel,
  getFreeModelsByCategory,
  type ModelEntry,
} from "./modelLists";
export {
  getLiveProviderModels,
  fetchLiveGroqModels,
  fetchLiveOpenRouterModels,
  fetchLiveOpenAIModels,
} from "./modelProviderService";

/**
 * Builds the failover router from every model that has an API key configured.
 * Groq free models are tried first, then the OpenRouter agentic free models —
 * each entry is one provider bound to one model, and the router transparently
 * switches to the next when one fails.
 */
export function buildLLMRouter(options?: LLMRouterOptions): LLMRouter {
  const providers: LLMProvider[] = [];
  const hasGroq = Boolean(env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY);

  for (const entry of ALL_FALLBACK_MODELS) {
    if (entry.provider === "groq" && hasGroq) providers.push(new GroqProvider(entry.model));
    if (entry.provider === "openrouter" && hasOpenRouter) providers.push(new OpenRouterProvider(entry.model));
  }

  return new LLMRouter(providers, options);
}

/**
 * Builds a dedicated failover router for a specific capability category (reasoning,
 * code, safety, audio, embedding, vision, router) across configured providers.
 */
export function buildCategoryRouter(
  category: ModelCategory | string,
  options?: LLMRouterOptions
): LLMRouter {
  const providers: LLMProvider[] = [];
  const hasGroq = Boolean(env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY);
  const roster = getCategoryFallbackModels(category);

  for (const entry of roster) {
    if (entry.provider === "groq" && hasGroq) providers.push(new GroqProvider(entry.model));
    if (entry.provider === "openrouter" && hasOpenRouter) providers.push(new OpenRouterProvider(entry.model));
  }

  return new LLMRouter(providers, options);
}

/**
 * Returns the default configured LLM provider — an auto-failover router over every
 * configured Groq + OpenRouter free model.
 */
export function getLLMProvider(): LLMProvider {
  return buildLLMRouter();
}

/**
 * Returns a category-specific failover router.
 */
export function getProviderForCategory(category: ModelCategory | string): LLMProvider {
  return buildCategoryRouter(category);
}

export interface ProviderOverrideOptions extends LLMRouterOptions {
  customApiKey?: string;
  customApiBaseUrl?: string;
  customApiProvider?: string;
}

/**
 * Resolves an explicit LLM provider for a specific model ID with category-aware fallback.
 * If a custom API base URL or custom API key is supplied, a direct OpenAI-compatible
 * provider is initialized with failover to configured standard providers.
 */
export function getProviderForModel(modelName?: string, options?: ProviderOverrideOptions): LLMProvider {
  // If custom API Key or Base URL is specified for this node
  if (options?.customApiBaseUrl || options?.customApiKey) {
    const customProvider = new CustomOpenAICompatibleProvider({
      model: modelName || "gpt-4o",
      apiKey: options.customApiKey,
      baseUrl: options.customApiBaseUrl,
      providerName: options.customApiProvider || "custom-model-api",
    });

    const fallbackChain = getFallbackChainForModel(modelName || "general");
    const providers: LLMProvider[] = [customProvider];
    const hasGroq = Boolean(env.GROQ_API_KEY);
    const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY);

    for (const entry of fallbackChain) {
      if (entry.provider === "groq" && hasGroq) {
        providers.push(new GroqProvider(entry.model));
      } else if (entry.provider === "openrouter" && hasOpenRouter) {
        providers.push(new OpenRouterProvider(entry.model));
      }
    }

    return new LLMRouter(providers, options);
  }

  if (!modelName || modelName === "auto" || modelName === "auto-failover" || modelName === "") {
    return buildLLMRouter(options);
  }

  const fallbackChain = getFallbackChainForModel(modelName);
  const providers: LLMProvider[] = [];
  const hasGroq = Boolean(env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY);

  for (const entry of fallbackChain) {
    const isTarget = entry.model === modelName;
    if (entry.provider === "groq" && (hasGroq || isTarget)) {
      providers.push(new GroqProvider(entry.model));
    } else if (entry.provider === "openrouter" && (hasOpenRouter || isTarget)) {
      providers.push(new OpenRouterProvider(entry.model));
    }
  }

  if (providers.length > 0) {
    return new LLMRouter(providers, options);
  }

  // Direct fallback
  const isGroq =
    modelName.startsWith("groq/") ||
    modelName.startsWith("canopylabs/") ||
    modelName.startsWith("whisper-");

  return isGroq ? new GroqProvider(modelName) : new OpenRouterProvider(modelName);
}

