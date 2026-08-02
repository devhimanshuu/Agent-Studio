import { LLMProvider, LLMChatMessage, LLMCompletionOptions, LLMCompletionResult, LLMError } from "./LLMProvider";
import { chatCompletionRequest } from "./http";
import { env } from "@/lib/config/env";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * OpenRouter provider — one instance per model. Failover between models is
 * handled by the LLMRouter; this class only talks to the model it is bound to.
 */
export class OpenRouterProvider implements LLMProvider {
  readonly name = "openrouter";

  constructor(readonly model: string) {}

  isConfigured(): boolean {
    return Boolean(env.OPENROUTER_API_KEY);
  }

  async complete(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    if (!env.OPENROUTER_API_KEY) {
      throw new LLMError("OpenRouter API key is not configured", {
        provider: this.name,
        model: this.model,
        retryable: false,
      });
    }

    return chatCompletionRequest({
      endpoint: OPENROUTER_ENDPOINT,
      apiKey: env.OPENROUTER_API_KEY,
      model: this.model,
      messages,
      options,
      providerName: this.name,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      // Attribution headers required by OpenRouter for the leaderboard.
      extraHeaders: {
        "HTTP-Referer": env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-OpenRouter-Title": "Agent Studio",
      },
    });
  }
}
