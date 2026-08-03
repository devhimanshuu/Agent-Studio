import { describe, it, expect, vi } from "vitest";
import { withRetries } from "@/modules/execution/executor/retry";
import { LLMError } from "@/providers/llm";

const retryableError = () => new LLMError("transient", { provider: "groq", model: "m", retryable: true });
const fatalError = () => new Error("fatal");

describe("withRetries", () => {
  it("returns the result on the first attempt", async () => {
    const fn = vi.fn(async () => "ok");
    await expect(withRetries(fn, { attempts: 3 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("succeeds on a later attempt after retryable failures", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError())
      .mockRejectedValueOnce(retryableError())
      .mockResolvedValueOnce("recovered");
    await expect(withRetries(fn, { attempts: 3 })).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after exhausting attempts", async () => {
    const fn = vi.fn().mockRejectedValue(retryableError());
    await expect(withRetries(fn, { attempts: 3 })).rejects.toBeInstanceOf(LLMError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("fails fast on a non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(fatalError());
    await expect(withRetries(fn, { attempts: 3 })).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("invokes onRetry before each retry with the attempt number", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError())
      .mockResolvedValueOnce("ok");
    await withRetries(fn, { attempts: 3, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(LLMError));
  });
});
