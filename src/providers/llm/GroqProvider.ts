import { z } from "zod";
import { LLMProvider, LLMChatMessage, LLMCompletionOptions, LLMCompletionResult, LLMError, LLMStreamChunk } from "./LLMProvider";
import { chatCompletionRequest, streamChatCompletion } from "./http";
import { requestStructuredOutput } from "./structuredOutput";
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

  private ensureConfigured(): void {
    if (!env.GROQ_API_KEY) {
      throw new LLMError("Groq API key is not configured", {
        provider: this.name,
        model: this.model,
        retryable: false,
      });
    }
  }

  async complete(messages: LLMChatMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    this.ensureConfigured();
    return chatCompletionRequest({
      endpoint: GROQ_ENDPOINT,
      apiKey: env.GROQ_API_KEY!,
      model: this.model,
      messages,
      options,
      providerName: this.name,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }

  generate(messages: LLMChatMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    return this.complete(messages, options);
  }

  stream(messages: LLMChatMessage[], options?: LLMCompletionOptions): Promise<AsyncIterable<LLMStreamChunk>> {
    this.ensureConfigured();
    return streamChatCompletion({
      endpoint: GROQ_ENDPOINT,
      apiKey: env.GROQ_API_KEY!,
      model: this.model,
      messages,
      options,
      providerName: this.name,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }

  structuredOutput<T>(messages: LLMChatMessage[], schema: z.ZodType<T>, options?: LLMCompletionOptions): Promise<T> {
    return requestStructuredOutput(this, messages, schema, options);
  }
}
