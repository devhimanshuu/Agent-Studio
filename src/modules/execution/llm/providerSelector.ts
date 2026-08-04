import {
  LLMProvider,
  LLMRouter,
  GroqProvider,
  OpenRouterProvider,
  ALL_FALLBACK_MODELS,
} from "@/providers/llm";

export interface LLMProviderConfig {
  groqApiKey?: string;
  openRouterApiKey?: string;
}

/**
 * Builds the failover router from an explicit config (testable — no process.env
 * dependency). Groq free models are tried first, then the OpenRouter agentic
 * free models. Vendors without a key are skipped entirely.
 */
export function createLLMRouterFromConfig(config: LLMProviderConfig): LLMRouter {
  const providers: LLMProvider[] = [];
  for (const entry of ALL_FALLBACK_MODELS) {
    if (entry.provider === "groq" && config.groqApiKey) {
      providers.push(new GroqProvider(entry.model, config.groqApiKey));
    }
    if (entry.provider === "openrouter" && config.openRouterApiKey) {
      providers.push(new OpenRouterProvider(entry.model, config.openRouterApiKey));
    }
  }
  return new LLMRouter(providers);
}

/** Number of candidate models available for a given config (used in tests/UI). */
export function countConfiguredModels(config: LLMProviderConfig): number {
  return ALL_FALLBACK_MODELS.filter((entry) =>
    entry.provider === "groq" ? Boolean(config.groqApiKey) : Boolean(config.openRouterApiKey)
  ).length;
}

/** Ordered list of model IDs that would be tried for a given config. */
export function listConfiguredModels(config: LLMProviderConfig): string[] {
  return ALL_FALLBACK_MODELS.filter((entry) =>
    entry.provider === "groq" ? Boolean(config.groqApiKey) : Boolean(config.openRouterApiKey)
  ).map((entry) => entry.model);
}
