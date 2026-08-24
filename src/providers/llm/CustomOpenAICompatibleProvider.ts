import { z } from "zod";
import {
  LLMProvider,
  LLMChatMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamChunk,
} from "./LLMProvider";
import { chatCompletionRequest, streamChatCompletion } from "./http";
import { requestStructuredOutput } from "./structuredOutput";

const DEFAULT_TIMEOUT_MS = 120_000;

export interface CustomProviderConfig {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  providerName?: string;
  extraHeaders?: Record<string, string>;
}

/**
 * Universal OpenAI-compatible LLM Provider.
 * Allows connecting any custom endpoint: Ollama, vLLM, LM Studio, DeepSeek,
 * OpenAI, Anthropic (via proxy), Together AI, Groq, or enterprise gateways.
 */
export class CustomOpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(config: CustomProviderConfig | string) {
    if (typeof config === "string") {
      this.model = config;
      this.name = "custom-llm";
      this.baseUrl = "https://api.openai.com/v1";
      this.extraHeaders = {};
    } else {
      this.model = config.model;
      this.name = config.providerName || "custom-llm";
      this.apiKey = config.apiKey;
      this.baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
      this.extraHeaders = config.extraHeaders || {};
    }
  }

  isConfigured(): boolean {
    if (this.baseUrl.includes("localhost") || this.baseUrl.includes("127.0.0.1") || this.baseUrl.includes("192.168.")) {
      return true;
    }
    return Boolean(this.apiKey);
  }

  private get endpoint(): string {
    if (this.baseUrl.endsWith("/chat/completions")) {
      return this.baseUrl;
    }
    return `${this.baseUrl}/chat/completions`;
  }

  async complete(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    return chatCompletionRequest({
      endpoint: this.endpoint,
      apiKey: this.apiKey || "",
      model: this.model,
      messages,
      options,
      providerName: this.name,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      extraHeaders: this.extraHeaders,
    });
  }

  generate(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    return this.complete(messages, options);
  }

  stream(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    return streamChatCompletion({
      endpoint: this.endpoint,
      apiKey: this.apiKey || "",
      model: this.model,
      messages,
      options,
      providerName: this.name,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      extraHeaders: this.extraHeaders,
    });
  }

  structuredOutput<T>(
    messages: LLMChatMessage[],
    schema: z.ZodType<T>,
    options?: LLMCompletionOptions
  ): Promise<T> {
    return requestStructuredOutput(this, messages, schema, options);
  }
}
