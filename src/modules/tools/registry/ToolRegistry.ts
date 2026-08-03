import { logger } from "@/lib/logger";
import { Tool } from "../interfaces/Tool";
import { ToolCategoryDef, isToolCategory, TOOL_CATEGORIES } from "../categories";
import { BUILT_IN_TOOLS } from "../builtins";
import {
  ToolError,
  ToolNotFoundError,
  ToolDisabledError,
  ToolValidationError,
  ToolTimeoutError,
  ToolExecutionFailureError,
} from "../errors";
import { ToolCategory } from "@/types/tool";

export interface ToolRegistryOptions {
  /** Default per-invocation wall-clock budget in ms. Default 30s. */
  timeoutMs?: number;
}

const DEFAULT_TOOL_TIMEOUT_MS = 30_000;

/**
 * The single tool execution surface. The Agent Runtime executes tools ONLY
 * through this registry — never instantiating tools directly.
 *
 * Adding a new tool: implement the `Tool` interface and pass it to
 * `registerTool` (built-ins self-register via `ToolRegistry.withBuiltInTools()`
 * or the `createToolRegistry()` factory).
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  constructor(private options: ToolRegistryOptions = {}) {}

  /** Registry pre-loaded with the four built-in tools. */
  static withBuiltInTools(): ToolRegistry {
    return createBuiltInRegistry();
  }

  registerTool(tool: Tool): void {
    if (!tool?.name) throw new Error("Cannot register a tool without a name");
    if (tool.id !== tool.name) throw new Error(`Tool "${tool.name}" must use its id as the registry name`);
    // Category-first: every tool must declare a category from the taxonomy at
    // registration time — a typo fails fast instead of silently producing an
    // uncategorized tool on the dashboard.
    if (!isToolCategory(tool.category)) {
      // Coupling note: the taxonomy must be updated alongside new tools — add
      // the category to TOOL_CATEGORIES in modules/tools/categories.ts first.
      throw new Error(`Tool "${tool.name}" declares unknown category "${tool.category}". Add it to TOOL_CATEGORIES in modules/tools/categories.ts`);
    }
    if (this.tools.has(tool.name)) throw new Error(`Tool "${tool.name}" is already registered`);
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | null {
    return this.tools.get(name) ?? null;
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /** All registered tools (enabled and disabled). */
  listTools(): Tool[] {
    return [...this.tools.values()];
  }

  /** Enabled tools only — the surface a skill can actually execute. */
  getAvailableTools(): Tool[] {
    return [...this.tools.values()].filter((tool) => tool.enabled);
  }

  /** Category taxonomy in presentation order (labels, descriptions, order). */
  listCategories(): ToolCategoryDef[] {
    return TOOL_CATEGORIES;
  }

  /** All registered tools in the given category (presentation order is the
   * registration order). */
  getToolsByCategory(category: ToolCategory): Tool[] {
    return [...this.tools.values()].filter((tool) => tool.category === category);
  }

  /** Registered-tool count per category (dashboard summary chips). */
  countToolsByCategory(): Record<ToolCategory, number> {
    const counts: Record<ToolCategory, number> = {
      COMPUTE: 0,
      SEARCH: 0,
      DATA: 0,
      TASK: 0,
    };
    for (const tool of this.tools.values()) {
      if (tool.category in counts) counts[tool.category] += 1;
    }
    return counts;
  }

  /** Returns human-readable input issues for a tool ([] = valid). Throws
   * ToolNotFoundError for unregistered tools. */
  validateTool(name: string, input: Record<string, unknown>): string[] {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolNotFoundError(name);
    return tool.validate(input);
  }

  /**
   * Executes a registered, enabled tool with a validated input. Throws:
   *  - ToolNotFoundError / ToolDisabledError (pre-execution)
   *  - ToolValidationError (invalid input — never retried)
   *  - ToolTimeoutError (budget exceeded — never retried)
   *  - ToolExecutionFailureError (underlying execution failure)
   */
  async executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolNotFoundError(name);
    if (!tool.enabled) throw new ToolDisabledError(name);

    logger.info({ tool: name }, "Tool Requested");
    logger.info({ tool: name }, "Validation Started");
    const issues = tool.validate(input);
    if (issues.length > 0) {
      logger.warn({ tool: name, issues }, "Validation Failed");
      throw new ToolValidationError(name, issues);
    }
    logger.info({ tool: name }, "Validation Passed");

    const startedAt = Date.now();
    const timeoutMs = tool.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
    logger.info({ tool: name }, "Tool Started");
    try {
      const output = await withTimeout(tool.execute(input), timeoutMs, name);
      logger.info({ tool: name, durationMs: Date.now() - startedAt }, "Tool Completed");
      return output;
    } catch (error) {
      if (error instanceof ToolError) throw error;
      logger.error({ tool: name, error: errorMessage(error) }, "Tool Failed");
      throw new ToolExecutionFailureError(name, errorMessage(error));
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown failure";
}

/** Race the tool against its wall-clock budget. NOTE: the underlying tool
 * promise is not aborted — it keeps running in the background until it settles
 * (harmless for the stateless mock tools; a future long-running tool should
 * wire its own abort signal). */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, toolName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ToolTimeoutError(toolName, timeoutMs)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timer);
        reject(reason);
      }
    );
  });
}

function createBuiltInRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of BUILT_IN_TOOLS) registry.registerTool(tool);
  return registry;
}
