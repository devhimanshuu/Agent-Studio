import { LLMProvider, LLMChatMessage, LLMCompletionOptions, LLMCompletionResult, LLMError } from "./LLMProvider";
import { chatCompletionRequest } from "./http";
import { env } from "@/lib/config/env";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Groq provider — one instance per model. Failover between models is handled
 * by the LLMRouter; this class only talks to the model it is bound to.
 */
export class GroqProvider implements LLMProvider {
  readonly name = "groq";

  constructor(readonly model: string) {}

  isConfigured(): boolean {
    return Boolean(env.GROQ_API_KEY);
  }

  async complete(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    if (!env.GROQ_API_KEY) {
      throw new LLMError("Groq API key is not configured", {
        provider: this.name,
        model: this.model,
        retryable: false,
      });
    }

    return chatCompletionRequest({
      endpoint: GROQ_ENDPOINT,
      apiKey: env.GROQ_API_KEY,
      model: this.model,
      messages,
      options,
      providerName: this.name,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }
}
