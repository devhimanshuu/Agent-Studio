import { describe, it, expect, vi } from "vitest";
import { withRetries } from "@/modules/execution/executor/retry";
import {
  ToolRegistry,
  ToolValidationError,
  ToolTimeoutError,
  ToolExecutionFailureError,
  ToolNotFoundError,
  ToolDisabledError,
} from "@/modules/tools";
import { isRetryableToolFailure } from "@/modules/execution/graph/nodes";
import { makeTool } from "./helpers/makeTool";

describe("Execution failure handling", () => {
  it("retries transient tool failures once (predicate returns true)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ToolExecutionFailureError("alpha", "transient"))
      .mockResolvedValueOnce("recovered");

    await expect(withRetries(fn, { attempts: 2, isRetryable: isRetryableToolFailure })).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never retries invalid-input (ToolValidationError) or timeout (ToolTimeoutError) errors", async () => {
    const validationError = new ToolValidationError("alpha", ["a: required"]);
    const timeoutError = new ToolTimeoutError("alpha", 1000);

    expect(isRetryableToolFailure(validationError)).toBe(false);
    expect(isRetryableToolFailure(timeoutError)).toBe(false);

    const fn = vi.fn().mockRejectedValue(validationError);
    await expect(withRetries(fn, { attempts: 2, isRetryable: isRetryableToolFailure })).rejects.toBe(validationError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("never retries domain errors from the runtime", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("plain error"));
    // Plain errors ARE retryable (transient)…
    expect(isRetryableToolFailure(new Error("plain"))).toBe(true);
    await expect(withRetries(fn, { attempts: 2, isRetryable: isRetryableToolFailure })).rejects.toThrow("plain error");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after maximum retries", async () => {
    const fn = vi.fn().mockRejectedValue(new ToolExecutionFailureError("alpha", "always down"));
    await expect(withRetries(fn, { attempts: 3, isRetryable: isRetryableToolFailure })).rejects.toThrow("always down");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("surfaces deterministic registry errors unmapped to the caller", async () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool({ name: "alpha", validate: () => ["a: required"] }));

    await expect(registry.executeTool("alpha", {})).rejects.toBeInstanceOf(ToolValidationError);
    await expect(registry.executeTool("ghost", {})).rejects.toBeInstanceOf(ToolNotFoundError);
  });

  it("maps only unexpected execution failures to ToolExecutionFailureError", async () => {
    const registry = new ToolRegistry();
    registry.registerTool(
      makeTool({
        name: "alpha",
        execute: async () => {
          throw new Error("vendor hiccup");
        },
      })
    );

    const error = await registry.executeTool("alpha", {}).catch((e) => e);
    expect(error).toBeInstanceOf(ToolExecutionFailureError);
    // The registry never wraps ToolError subclasses again (no double-wrapping).
    const registry2 = new ToolRegistry();
    registry2.registerTool(
      makeTool({
        name: "beta",
        execute: async () => {
          throw new ToolDisabledError("beta");
        },
      })
    );
    const direct = await registry2.executeTool("beta", {}).catch((e) => e);
    expect(direct).toBeInstanceOf(ToolDisabledError);
  });
});
