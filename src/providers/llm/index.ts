import { LLMProvider } from "./LLMProvider";
import { GroqProvider } from "./GroqProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";
import { LLMRouter, LLMRouterOptions } from "./LLMRouter";
import { ALL_FALLBACK_MODELS } from "./modelLists";
import { env } from "@/lib/config/env";

export type { LLMProvider, LLMChatMessage, LLMCompletionOptions, LLMCompletionResult, LLMStreamChunk, LLMTool, LLMToolCall } from "./LLMProvider";
export { LLMError } from "./LLMProvider";
export { GroqProvider } from "./GroqProvider";
export { OpenRouterProvider } from "./OpenRouterProvider";
export { LLMRouter, type LLMRouterOptions } from "./LLMRouter";
export {
  GROQ_FREE_MODELS,
  OPENROUTER_FREE_MODELS,
  ALL_FALLBACK_MODELS,
  findModelEntry,
  getFreeModelsByCategory,
  type ModelEntry,
} from "./modelLists";

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
 * Returns the configured LLM provider — an auto-failover router over every
 * configured Groq + OpenRouter free model. If no keys are set the router is
 * empty and `complete()` throws a clear configuration error.
 */
export function getLLMProvider(): LLMProvider {
  return buildLLMRouter();
}
