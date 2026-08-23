import { describe, it, expect, vi } from "vitest";
import { LLMRouter } from "@/providers/llm/LLMRouter";
import {
  LLMProvider,
  LLMCompletionResult,
  LLMError,
} from "@/providers/llm/LLMProvider";

function makeProvider(
  name: string,
  model: string,
  behavior: { result?: LLMCompletionResult; error?: Error }
): LLMProvider {
  const run = async () => {
    if (behavior.error) throw behavior.error;
    return behavior.result ?? okResult(`${name}-${model} response`);
  };
  const provider = {
    name,
    model,
    isConfigured: () => true,
    complete: vi.fn(run),
    generate: vi.fn(run),
    stream: vi.fn(async () => {
      if (behavior.error) throw behavior.error;
      const iter = {
        async *[Symbol.asyncIterator]() {
          yield { type: "content" as const, content: "streamed" };
          yield { type: "done" as const };
        },
      };
      return iter;
    }),
    structuredOutput: (async () => {
      if (behavior.error) throw behavior.error;
      return { content: "parsed" };
    }) as LLMProvider["structuredOutput"],
  };
  return provider as LLMProvider;
}

const okResult = (content: string): LLMCompletionResult => ({
  content,
  finishReason: "stop",
  usage: { inputTokens: 10, outputTokens: 5 },
});

describe("LLMRouter", () => {
  it("returns the first healthy model's result", async () => {
    const p1 = makeProvider("groq", "model-a", { result: okResult("from-a") });
    const router = new LLMRouter([p1]);

    const result = await router.complete([{ role: "user", content: "hi" }]);
    expect(result.content).toBe("from-a");
  });

  it("falls back to the next model when the first fails", async () => {
    const p1 = makeProvider("groq", "model-a", {
      error: new LLMError("rate limited", { provider: "groq", model: "model-a", status: 429 }),
    });
    const p2 = makeProvider("groq", "model-b", { result: okResult("from-b") });
    const router = new LLMRouter([p1, p2]);

    const result = await router.complete([{ role: "user", content: "hi" }]);
    expect(result.content).toBe("from-b");
  });

  it("switches providers entirely when one vendor fails", async () => {
    const groq = makeProvider("groq", "model-a", {
      error: new LLMError("down", { provider: "groq", model: "model-a", status: 500 }),
    });
    const openRouter = makeProvider("openrouter", "model-b:free", { result: okResult("from-or") });
    const router = new LLMRouter([groq, openRouter]);

    const result = await router.complete([{ role: "user", content: "hi" }]);
    expect(result.content).toBe("from-or");
  });

  it("skips models parked in cooldown and uses them again once healthy", async () => {
    let calls = 0;
    const flaky = {
      name: "groq",
      model: "flaky",
      isConfigured: () => true,
      complete: vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          throw new LLMError("timeout", { provider: "groq", model: "flaky", status: 408 });
        }
        return okResult("recovered");
      }),
      generate: vi.fn(),
      stream: vi.fn(),
      structuredOutput: (async () => ({})) as LLMProvider["structuredOutput"],
    } satisfies LLMProvider;
    const backup = makeProvider("groq", "backup", { result: okResult("backup") });
    const router = new LLMRouter([flaky, backup]);

    // First call: flaky fails (goes into 30s cooldown), backup serves.
    const first = await router.complete([{ role: "user", content: "hi" }]);
    expect(first.content).toBe("backup");
    expect(backup.complete).toHaveBeenCalledTimes(1);

    // Second call: flaky is still cooling down → backup serves again.
    const second = await router.complete([{ role: "user", content: "hi" }]);
    expect(second.content).toBe("backup");
    expect(backup.complete).toHaveBeenCalledTimes(2);

    // After the cooldown elapses, flaky is tried again and serves.
    vi.useFakeTimers();
    vi.advanceTimersByTime(31_000);
    const third = await router.complete([{ role: "user", content: "hi" }]);
    expect(third.content).toBe("recovered");
    vi.useRealTimers();
  });

  it("parks the whole provider on auth failure (401)", async () => {
    const badKey = makeProvider("groq", "model-a", {
      error: new LLMError("invalid key", { provider: "groq", model: "model-a", status: 401 }),
    });
    const good = makeProvider("openrouter", "model-b", { result: okResult("from-or") });
    const router = new LLMRouter([badKey, good]);

    const result = await router.complete([{ role: "user", content: "hi" }]);
    expect(result.content).toBe("from-or");

    // Provider-level cooldown means the bad provider is skipped without retrying.
    await router.complete([{ role: "user", content: "hi" }]);
    expect(badKey.complete).toHaveBeenCalledTimes(1);
    expect(good.complete).toHaveBeenCalledTimes(2);
  });

  it("calls onSwitch with from/to/reason as it moves down the list", async () => {
    const p1 = makeProvider("groq", "model-a", {
      error: new LLMError("boom", { provider: "groq", model: "model-a", status: 500 }),
    });
    const p2 = makeProvider("groq", "model-b", { result: okResult("from-b") });
    const onSwitch = vi.fn();
    const router = new LLMRouter([p1, p2], { onSwitch });

    await router.complete([{ role: "user", content: "hi" }]);
    expect(onSwitch).toHaveBeenCalledWith("groq/model-a", "groq/model-b", "boom");
  });

  it("throws an aggregated error when every model fails", async () => {
    const p1 = makeProvider("groq", "model-a", {
      error: new LLMError("bad", { provider: "groq", model: "model-a", status: 500 }),
    });
    const p2 = makeProvider("openrouter", "model-b:free", {
      error: new LLMError("worse", { provider: "openrouter", model: "model-b:free", status: 429 }),
    });
    const router = new LLMRouter([p1, p2]);

    // The thrown message is deliberately generic — vendor error details stay
    // in the logs, never in the error surface to callers.
    await expect(router.complete([{ role: "user", content: "hi" }])).rejects.toThrow(
      /All 2 LLM model\(s\) failed/
    );
  });

  it("reports a clear message when every model is parked in cooldown", async () => {
    const p1 = makeProvider("groq", "model-a", {
      error: new LLMError("rate limited", { provider: "groq", model: "model-a", status: 429 }),
    });
    const router = new LLMRouter([p1]);

    // First call parks the only model (60s cooldown) and fails.
    await expect(router.complete([{ role: "user", content: "hi" }])).rejects.toThrow(
      /All 1 LLM model\(s\) failed/
    );
    // Immediate retry: the model is cooling down → distinct cooldown message.
    await expect(router.complete([{ role: "user", content: "hi" }])).rejects.toThrow(
      /temporarily unavailable \(cooldown\)/
    );
    expect(p1.complete).toHaveBeenCalledTimes(1);
  });

  it("throws a clear configuration error when no providers are configured", async () => {
    const router = new LLMRouter([]);
    await expect(router.complete([{ role: "user", content: "hi" }])).rejects.toThrow(
      /No LLM providers configured/
    );
  });

  it("stream reports cooldown (not a config error) when every model is parked", async () => {
    const p1 = makeProvider("groq", "model-a", {
      error: new LLMError("rate limited", { provider: "groq", model: "model-a", status: 429 }),
    });
    const router = new LLMRouter([p1]);

    // First call fails and parks the only model (60s cooldown).
    await expect(router.stream([{ role: "user", content: "hi" }])).rejects.toThrow(/All 1 LLM model\(s\) failed/);
    // Immediate retry: the model is cooling down → distinct cooldown message,
    // NOT the misleading "No LLM providers configured" config error.
    await expect(router.stream([{ role: "user", content: "hi" }])).rejects.toThrow(
      /temporarily unavailable \(cooldown\)/
    );
    // And the config error only fires when nothing is configured at all.
    const empty = new LLMRouter([]);
    await expect(empty.stream([{ role: "user", content: "hi" }])).rejects.toThrow(/No LLM providers configured/);
  });

  it("does not report an unconfigured provider as available", () => {
    const configured = makeProvider("groq", "model-a", { result: okResult("ok") });
    const unconfigured = makeProvider("openrouter", "model-b:free", { result: okResult("never called") });
    (unconfigured as { isConfigured: () => boolean }).isConfigured = () => false;
    const router = new LLMRouter([unconfigured, configured]);
    expect(router.isConfigured()).toBe(true);
  });
});
