import { Tool } from "../interfaces/Tool";
import {
  codeExecutionInputValidator,
  codeExecutionInputSchema,
  codeExecutionOutputSchema,
} from "../validators/codeExecution";

// Dynamic import to avoid bundling Node.js modules for client-side
let sandboxRunner: typeof import("./sandboxRunner") | null = null;

async function getSandboxRunner() {
  if (!sandboxRunner) {
    sandboxRunner = await import("./sandboxRunner");
  }
  return sandboxRunner;
}

/**
 * Sandboxed code execution tool: lets agents write and safely execute
 * JavaScript (via Node.js vm) or Python (via subprocess) code on the fly.
 *
 * Security: no filesystem access, no network, no process globals, strict
 * timeout, output truncated at 100 KB.
 */
export const codeExecutionTool: Tool = {
  id: "code_execution",
  name: "code_execution",
  displayName: "Code Execution Sandbox",
  description:
    "Execute JavaScript or Python code in an isolated sandbox. Use for data processing, calculations, text manipulation, regex, JSON transformation, or any algorithmic task. Supports top-level await in JavaScript.",
  category: "COMPUTE",
  type: "READ",
  inputSchema: codeExecutionInputSchema,
  outputSchema: codeExecutionOutputSchema,
  requiresApproval: false,
  enabled: true,
  timeoutMs: 35_000, // Slightly above max user timeout to allow cleanup

  validate(input) {
    const parsed = codeExecutionInputValidator.safeParse(input);
    if (parsed.success) return [];
    return parsed.error.issues.map((i) =>
      i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message
    );
  },

  async execute(input) {
    const parsed = codeExecutionInputValidator.parse(input);
    const { language, code, timeout } = parsed;
    const runner = await getSandboxRunner();

    switch (language) {
      case "javascript":
        return runner.runJavaScript(code, timeout);
      case "python":
        return runner.runPython(code, timeout);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  },

  async healthCheck() {
    const started = Date.now();
    try {
      const runner = await getSandboxRunner();
      const result = await runner.runJavaScript('console.log("ok")', 5000);
      if (result.exitCode === 0 && result.stdout.trim() === "ok") {
        return { status: "healthy" as const, latencyMs: Date.now() - started };
      }
      return {
        status: "degraded" as const,
        latencyMs: Date.now() - started,
        message: "Sandbox returned unexpected output",
      };
    } catch (error) {
      return {
        status: "unavailable" as const,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  },
};
