import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ToolRegistry,
  ToolNotFoundError,
  ToolDisabledError,
  ToolValidationError,
  ToolTimeoutError,
  ToolExecutionFailureError,
  createToolRegistry,
} from "@/modules/tools";
import { makeTool } from "./helpers/makeTool";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ToolRegistry", () => {
  it("registers and resolves tools, and lists available (enabled) tools", () => {
    const registry = new ToolRegistry();
    const enabled = makeTool({ name: "alpha" });
    const disabled = makeTool({ name: "beta", enabled: false });
    registry.registerTool(enabled);
    registry.registerTool(disabled);

    expect(registry.getTool("alpha")).toBe(enabled);
    expect(registry.hasTool("beta")).toBe(true);
    expect(registry.getTool("ghost")).toBeNull();
    expect(registry.listTools()).toHaveLength(2);
    expect(registry.getAvailableTools().map((t) => t.name)).toEqual(["alpha"]);
  });

  it("rejects duplicate, unnamed, or id-mismatched registrations", () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool({ name: "alpha" }));
    expect(() => registry.registerTool(makeTool({ name: "alpha" }))).toThrow(/already registered/);
    expect(() => registry.registerTool(makeTool({ name: "" }))).toThrow(/without a name/);
    expect(() => registry.registerTool(makeTool({ id: "x", name: "y" }))).toThrow(/id as the registry name/);
  });

  it("self-registers all built-in tools through the factory", () => {
    const registry = createToolRegistry();
    const names = registry.getAvailableTools().map((t) => t.name).sort();
    expect(names).toEqual(["calculator", "document_search", "mock_task_creator", "record_lookup"]);
  });

  it("validateTool returns issues for malformed input and throws for unknown tools", () => {
    const registry = new ToolRegistry();
    registry.registerTool(
      makeTool({
        name: "calculator",
        validate: (input) => (typeof input.a === "number" ? [] : ["a: a must be a number"]),
      })
    );

    expect(registry.validateTool("calculator", { a: 1 })).toEqual([]);
    expect(registry.validateTool("calculator", { a: "one" })).toEqual(["a: a must be a number"]);
    expect(() => registry.validateTool("ghost", {})).toThrow(ToolNotFoundError);
  });

  it("executes a tool and returns its output", async () => {
    const registry = new ToolRegistry();
    const execute = vi.fn(async () => 42);
    registry.registerTool(makeTool({ name: "alpha", execute }));

    await expect(registry.executeTool("alpha", {})).resolves.toBe(42);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("throws ToolNotFoundError / ToolDisabledError before execution", async () => {
    const registry = new ToolRegistry();
    const execute = vi.fn(async () => 1);
    registry.registerTool(makeTool({ name: "alpha", enabled: false, execute }));

    await expect(registry.executeTool("ghost", {})).rejects.toBeInstanceOf(ToolNotFoundError);
    await expect(registry.executeTool("alpha", {})).rejects.toBeInstanceOf(ToolDisabledError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("throws ToolValidationError without executing on invalid input", async () => {
    const registry = new ToolRegistry();
    const execute = vi.fn(async () => 1);
    registry.registerTool(
      makeTool({ name: "alpha", execute, validate: () => ["a: required"] })
    );

    await expect(registry.executeTool("alpha", {})).rejects.toBeInstanceOf(ToolValidationError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("wraps execution failures in ToolExecutionFailureError without nesting", async () => {
    const registry = new ToolRegistry();
    registry.registerTool(
      makeTool({
        name: "alpha",
        execute: async () => {
          throw new Error("boom");
        },
      })
    );

    const error = (await registry.executeTool("alpha", {}).catch((e) => e)) as Error;
    expect(error).toBeInstanceOf(ToolExecutionFailureError);
    expect(error.message).toBe("boom");
  });

  it("enforces the per-tool wall-clock timeout", async () => {
    const registry = new ToolRegistry({ timeoutMs: 20 });
    registry.registerTool(
      makeTool({
        name: "alpha",
        execute: () => new Promise((resolve) => setTimeout(() => resolve(1), 500)),
      })
    );

    const error = (await registry.executeTool("alpha", {}).catch((e) => e)) as Error;
    expect(error).toBeInstanceOf(ToolTimeoutError);
    expect(error.message).toMatch(/timed out after 20ms/);
  });

  it("honors a tool-level timeoutMs over the registry default", async () => {
    const registry = new ToolRegistry({ timeoutMs: 5000 });
    registry.registerTool(
      makeTool({
        name: "alpha",
        timeoutMs: 15,
        execute: () => new Promise((resolve) => setTimeout(() => resolve(1), 500)),
      })
    );

    const error = (await registry.executeTool("alpha", {}).catch((e) => e)) as Error;
    expect(error).toBeInstanceOf(ToolTimeoutError);
    expect(error.message).toMatch(/timed out after 15ms/);
  });
});
