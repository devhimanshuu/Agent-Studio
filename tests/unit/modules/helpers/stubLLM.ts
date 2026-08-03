import {
  LLMProvider,
  LLMChatMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMError,
  LLMStreamChunk,
} from "@/providers/llm";

export interface StubLLMOptions {
  /** Value returned by structuredOutput (usually a plan object). */
  plan?: unknown;
  /** Error thrown by structuredOutput (immediately, unless failNTimes set). */
  error?: Error;
  /** Fail the first N structuredOutput calls, then succeed. */
  failNTimes?: number;
  /** Value reported via the `lastUsed` property (provider used). */
  providerLabel?: string;
}

/** Deterministic LLM provider used to test the runtime without network access. */
export class StubLLM implements LLMProvider {
  readonly name = "stub";
  readonly model = "stub-model";
  calls: { method: string; messages: LLMChatMessage[]; options?: LLMCompletionOptions }[] = [];
  private attempts = 0;

  constructor(private options: StubLLMOptions) {}

  get lastUsed(): string | null {
    return this.options.providerLabel ?? "stub/stub-model";
  }

  isConfigured(): boolean {
    return true;
  }

  async complete(messages: LLMChatMessage[], _options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    this.calls.push({ method: "complete", messages });
    return { content: "ok", finishReason: "stop" };
  }

  generate(messages: LLMChatMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    return this.complete(messages, options);
  }

  async stream(_messages: LLMChatMessage[], _options?: LLMCompletionOptions): Promise<AsyncIterable<LLMStreamChunk>> {
    const iter = {
      async *[Symbol.asyncIterator]() {
        yield { type: "content" as const, content: "streamed" };
        yield { type: "done" as const };
      },
    };
    return iter;
  }

  async structuredOutput<T>(messages: LLMChatMessage[], _schema: unknown, options?: LLMCompletionOptions): Promise<T> {
    this.calls.push({ method: "structuredOutput", messages, options });
    this.attempts += 1;
    if (this.options.failNTimes && this.attempts <= this.options.failNTimes) {
      throw this.options.error ?? new LLMError("stub failure", { provider: this.name, model: this.model, retryable: true });
    }
    // Only honor a persistent error when no retry budget was configured.
    if (!this.options.failNTimes && this.options.error) throw this.options.error;
    return this.options.plan as T;
  }
}
