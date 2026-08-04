import { z } from "zod";
import { LLMProvider, LLMChatMessage, LLMCompletionOptions, LLMCompletionResult, LLMError, LLMStreamChunk } from "./LLMProvider";
import { chatCompletionRequest, streamChatCompletion } from "./http";
import { requestStructuredOutput } from "./structuredOutput";
import { env } from "@/lib/config/env";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * OpenRouter provider — one instance per model. Failover between models is
 * handled by the LLMRouter; this class only talks to the model it is bound to.
 */
export class OpenRouterProvider implements LLMProvider {
  readonly name = "openrouter";

  constructor(readonly model: string, private apiKey?: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey || env.OPENROUTER_API_KEY);
  }

  private ensureConfigured(): void {
    if (!this.effectiveApiKey) {
      throw new LLMError("OpenRouter API key is not configured", {
        provider: this.name,
        model: this.model,
        retryable: false,
      });
    }
  }

  private get effectiveApiKey(): string {
    return this.apiKey || env.OPENROUTER_API_KEY || "";
  }

  private extraHeaders(): Record<string, string> {
    // Attribution headers required by OpenRouter for the leaderboard.
    return {
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-OpenRouter-Title": "Agent Studio",
    };
  }

  async complete(messages: LLMChatMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    this.ensureConfigured();
    return chatCompletionRequest({
      endpoint: OPENROUTER_ENDPOINT,
      apiKey: this.effectiveApiKey,
      model: this.model,
      messages,
      options,
      providerName: this.name,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      extraHeaders: this.extraHeaders(),
    });
  }

  generate(messages: LLMChatMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    return this.complete(messages, options);
  }

  stream(messages: LLMChatMessage[], options?: LLMCompletionOptions): Promise<AsyncIterable<LLMStreamChunk>> {
    this.ensureConfigured();
    return streamChatCompletion({
      endpoint: OPENROUTER_ENDPOINT,
      apiKey: this.effectiveApiKey,
      model: this.model,
      messages,
      options,
      providerName: this.name,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      extraHeaders: this.extraHeaders(),
    });
  }

  structuredOutput<T>(messages: LLMChatMessage[], schema: z.ZodType<T>, options?: LLMCompletionOptions): Promise<T> {
    return requestStructuredOutput(this, messages, schema, options);
  }
}
