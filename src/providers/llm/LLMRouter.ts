import type { z } from "zod";
import {
  LLMProvider,
  LLMChatMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMError,
  LLMStreamChunk,
} from "./LLMProvider";
import { logger } from "@/lib/logger";

export interface LLMRouterOptions {
  /** Cooldown for transient failures (network/5xx). Default 30s. */
  cooldownMs?: number;
  /** Cooldown for rate limits (429). Default 60s. */
  rateLimitCooldownMs?: number;
  /** Cooldown for auth errors (401/403) — parks the whole provider. Default 5min. */
  authCooldownMs?: number;
  /** Cooldown for model-not-found (404). Default 10min. */
  goneCooldownMs?: number;
  /** Called each time the router gives up on one model and moves to the next. */
  onSwitch?: (from: string, to: string, reason: string) => void;
}

const DEFAULT_COOLDOWN_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const AUTH_COOLDOWN_MS = 5 * 60_000;
const GONE_COOLDOWN_MS = 10 * 60_000;

/**
 * Model-switching router.
 *
 * Holds an ordered list of providers (each bound to a single model) and tries
 * them in order. When a model fails for ANY reason — rate limit, 5xx, network
 * error, timeout, model decommissioned, bad payload — the router logs it,
 * parks the offender in a cooldown (circuit breaker), and transparently retries
 * with the next model. A working model clears its own cooldown so it is reused
 * once healthy again.
 */
export class LLMRouter implements LLMProvider {
  readonly name = "llm-router";
  readonly model = "auto-failover";

  /** providerKey -> timestamp (ms) when it may be tried again. */
  private modelCooldowns = new Map<string, number>();
  /** providerName -> timestamp (ms) — auth-level parking for the whole vendor. */
  private providerCooldowns = new Map<string, number>();
  /** The provider/model key that last served a successful call (e.g. `groq/llama-3.3-70b-versatile`). */
  private lastUsedKey: string | null = null;

  constructor(
    private providers: LLMProvider[],
    private options: LLMRouterOptions = {}
  ) {}

  /** The provider/model key that last served a successful call, or null. */
  get lastUsed(): string | null {
    return this.lastUsedKey;
  }

  isConfigured(): boolean {
    return this.providers.some((p) => p.isConfigured());
  }

  private key(provider: LLMProvider): string {
    return `${provider.name}/${provider.model}`;
  }

  private isCoolingDown(provider: LLMProvider): boolean {
    const now = Date.now();
    const modelUntil = this.modelCooldowns.get(this.key(provider)) ?? 0;
    const providerUntil = this.providerCooldowns.get(provider.name) ?? 0;
    return now < Math.max(modelUntil, providerUntil);
  }

  async complete(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    return this.runWithFailover((provider) => provider.complete(messages, options), "completion");
  }

  generate(messages: LLMChatMessage[], options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
    return this.complete(messages, options);
  }

  structuredOutput<T>(
    messages: LLMChatMessage[],
    schema: z.ZodType<T>,
    options?: LLMCompletionOptions
  ): Promise<T> {
    return this.runWithFailover(
      (provider) => provider.structuredOutput(messages, schema, options),
      "structured output"
    );
  }

  /**
   * Streams from the first available model. If the chosen model fails before
   * emitting its first chunk (rate limit, 5xx, timeout), the router switches
   * to the next model — each model is only attempted once per call.
   */
  async stream(
    messages: LLMChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    const candidates = this.providers.filter((p) => p.isConfigured() && !this.isCoolingDown(p));
    if (candidates.length === 0) {
      // Distinguish "nothing configured" from "everything is cooling down" —
      // same two messages `runWithFailover` produces for non-streaming calls.
      if (this.providers.length === 0 || !this.providers.some((p) => p.isConfigured())) {
        throw this.noProvidersError();
      }
      throw new LLMError("All LLM models are temporarily unavailable (cooldown)", {
        provider: this.name,
        model: "all",
        retryable: true,
      });
    }

    for (const provider of candidates) {
      try {
        const stream = await provider.stream(messages, options);
        const iterator = stream[Symbol.asyncIterator]();
        const first = await iterator.next();
        if (first.done) {
          // Empty stream — nothing to emit, treat as done.
          return emptyStream();
        }
        // First chunk received — the model is healthy. Keep using it.
        this.modelCooldowns.delete(this.key(provider));
        this.lastUsedKey = this.key(provider);
        return forwardStream(first, iterator);
      } catch (error) {
        this.handleFailure(provider, error);
      }
    }

    throw new LLMError(`All ${candidates.length} LLM model(s) failed to stream`, {
      provider: this.name,
      model: "all",
      retryable: true,
    });
  }

  /**
   * Shared failover loop for non-streaming calls: try each configured,
   * non-cooling-down provider in order, park failures, and switch automatically.
   */
  private async runWithFailover<T>(
    fn: (provider: LLMProvider) => Promise<T>,
    label: string
  ): Promise<T> {
    if (this.providers.length === 0) {
      throw this.noProvidersError();
    }

    const attempts: { provider: string; error: string }[] = [];

    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      if (this.isCoolingDown(provider)) continue;

      try {
        const result = await fn(provider);
        // It worked — clear any previous cooldown so we keep using it.
        this.modelCooldowns.delete(this.key(provider));
        this.lastUsedKey = this.key(provider);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown failure";
        attempts.push({ provider: this.key(provider), error: message });
        this.handleFailure(provider, error);
        // Surface the switch (the next provider, if any) to callers/logs.
        const next = this.nextAvailableProvider();
        this.options.onSwitch?.(this.key(provider), next ? this.key(next) : "none", message);
      }
    }

    // Log the full detail (incl. raw vendor messages) for diagnostics, but keep
    // the thrown message generic so internal details never leak to callers.
    logger.error({ label, attempts }, `All LLM models failed for ${label}`);
    throw new LLMError(
      attempts.length === 0
        ? "All LLM models are temporarily unavailable (cooldown)"
        : `All ${attempts.length} LLM model(s) failed for ${label}`,
      {
        provider: this.name,
        model: "all",
        retryable: true,
      }
    );
  }

  private noProvidersError(): LLMError {
    return new LLMError("No LLM providers configured. Set GROQ_API_KEY or OPENROUTER_API_KEY.", {
      provider: this.name,
      model: "none",
      retryable: false,
    });
  }

  /** Next non-cooldown, configured provider — used for switch logging. */
  private nextAvailableProvider(): LLMProvider | null {
    for (const provider of this.providers) {
      if (provider.isConfigured() && !this.isCoolingDown(provider)) return provider;
    }
    return null;
  }

  private handleFailure(provider: LLMProvider, error: unknown): void {
    const status = error instanceof LLMError ? error.status : undefined;
    const now = Date.now();
    const opts = this.options;

    if (status === 401 || status === 403) {
      // Bad/expired key: every model on this vendor fails — park the provider.
      this.providerCooldowns.set(provider.name, now + (opts.authCooldownMs ?? AUTH_COOLDOWN_MS));
      logger.warn({ provider: provider.name, err: error }, "LLM provider auth failure — parking provider");
    } else if (status === 404) {
      // Model decommissioned/renamed on the vendor. Long cooldown for this model.
      this.modelCooldowns.set(this.key(provider), now + (opts.goneCooldownMs ?? GONE_COOLDOWN_MS));
      logger.warn({ provider: provider.name, model: provider.model, err: error }, "LLM model not found — parking model");
    } else if (status === 429) {
      this.modelCooldowns.set(this.key(provider), now + (opts.rateLimitCooldownMs ?? RATE_LIMIT_COOLDOWN_MS));
      logger.warn({ provider: provider.name, model: provider.model, err: error }, "LLM rate limited — switching model");
    } else {
      // 5xx, timeout, network — transient, short cooldown.
      this.modelCooldowns.set(this.key(provider), now + (opts.cooldownMs ?? DEFAULT_COOLDOWN_MS));
      logger.warn({ provider: provider.name, model: provider.model, err: error }, "LLM model failed — switching model");
    }
  }
}

/** Async iterable that yields nothing (empty stream). */
async function* emptyStream(): AsyncGenerator<LLMStreamChunk> {
  yield { type: "done" };
}

/** Forward the already-fetched first chunk, then continue the given iterator. */
async function* forwardStream<T>(
  first: IteratorResult<T>,
  iterator: AsyncIterator<T>
): AsyncGenerator<T> {
  if (!first.done) yield first.value;
  while (true) {
    const next = await iterator.next();
    if (next.done) break;
    yield next.value;
  }
}
