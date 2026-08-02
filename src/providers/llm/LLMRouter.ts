import {
  LLMProvider,
  LLMChatMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMError,
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

  constructor(
    private providers: LLMProvider[],
    private options: LLMRouterOptions = {}
  ) {}

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
    if (this.providers.length === 0) {
      throw new LLMError("No LLM providers configured. Set GROQ_API_KEY or OPENROUTER_API_KEY.", {
        provider: this.name,
        model: "none",
        retryable: false,
      });
    }

    const attempts: { provider: string; error: string }[] = [];

    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      if (this.isCoolingDown(provider)) continue;

      try {
        const result = await provider.complete(messages, options);
        // It worked — clear any previous cooldown so we keep using it.
        this.modelCooldowns.delete(this.key(provider));
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown failure";
        attempts.push({ provider: this.key(provider), error: message });
        this.handleFailure(provider, error);
        // Surface the switch (the next provider, if any) to callers/logs.
        const next = this.nextAvailableProvider();
        this.options.onSwitch?.(
          this.key(provider),
          next ? this.key(next) : "none",
          message
        );
      }
    }

    // Log the full detail (incl. raw vendor messages) for diagnostics, but keep
    // the thrown message generic so internal details never leak to callers.
    logger.error({ attempts }, "All LLM models failed — no model left to serve the request");
    throw new LLMError(
      attempts.length === 0
        ? "All LLM models are temporarily unavailable (cooldown)"
        : `All ${attempts.length} LLM model(s) failed`,
      {
        provider: this.name,
        model: "all",
        retryable: true,
      }
    );
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
