/**
 * LLM provider abstraction.
 *
 * Every provider (Groq, OpenRouter, OpenAI, Anthropic, Gemini, local models)
 * implements this contract so business logic never depends on a concrete
 * vendor. A provider instance is bound to a SINGLE model — failover between
 * models/providers is handled by the LLMRouter, which tries each configured
 * provider in order and transparently switches when one fails.
 */

export interface LLMChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** OpenAI-compatible function tool definition. */
export interface LLMTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  /** Function tools offered to the model (sent as `tools` + `tool_choice: auto`). */
  tools?: LLMTool[];
  /** Per-request timeout in ms. Defaults to provider default (120s). */
  timeoutMs?: number;
}

export interface LLMToolCall {
  id?: string;
  name: string;
  /** Raw JSON string of the tool arguments — parse before use. */
  arguments: string;
}

export interface LLMCompletionResult {
  content: string;
  finishReason: "stop" | "length" | "tool_calls" | "unknown";
  toolCalls?: LLMToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMProvider {
  readonly name: string;
  /** The exact model ID this provider instance talks to (e.g. `llama-3.3-70b-versatile`). */
  readonly model: string;
  /** Complete a single-turn chat conversation against the bound model. */
  complete(messages: LLMChatMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult>;
  /** Whether this provider is configured (API key present, etc.). */
  isConfigured(): boolean;
}

/**
 * Typed error thrown by providers and the router. Carries enough context for
 * the router to decide the right recovery: cooldown, skip the provider, or
 * give up.
 */
export class LLMError extends Error {
  readonly provider: string;
  readonly model: string;
  /** HTTP status when the failure came from the vendor API. */
  readonly status?: number;
  /**
   * true when retrying another model is meaningful (429, 5xx, network,
   * timeout). false for auth/config errors where every model of the same
   * provider would fail too.
   */
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    message: string,
    opts: {
      provider: string;
      model: string;
      status?: number;
      retryable?: boolean;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "LLMError";
    this.provider = opts.provider;
    this.model = opts.model;
    this.status = opts.status;
    this.retryable = opts.retryable ?? true;
    this.cause = opts.cause;
  }
}
