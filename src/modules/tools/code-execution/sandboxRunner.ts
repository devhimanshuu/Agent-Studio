const MAX_OUTPUT_BYTES = 100 * 1024; // 100 KB
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

/**
 * Strips output to MAX_OUTPUT_BYTES, appending a truncation notice if needed.
 */
function truncate(output: string): string {
  if (Buffer.byteLength(output, "utf8") <= MAX_OUTPUT_BYTES) return output;
  const buf = Buffer.from(output, "utf8");
  return buf.subarray(0, MAX_OUTPUT_BYTES).toString("utf8") + "\n... [output truncated at 100 KB]";
}

/**
 * Restricted globals available inside the JS sandbox.
 * No process, no require, no import, no fs, no child_process.
 */
function createSandboxContext() {
  const logs: string[] = [];
  const errors: string[] = [];

  const ctx: Record<string, unknown> = {
    // Safe console that captures output
    console: {
      log: (...args: unknown[]) => logs.push(args.map(stringify).join(" ")),
      error: (...args: unknown[]) => errors.push(args.map(stringify).join(" ")),
      warn: (...args: unknown[]) => logs.push("[warn] " + args.map(stringify).join(" ")),
      info: (...args: unknown[]) => logs.push(args.map(stringify).join(" ")),
    },
    // Built-in globals
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    WeakMap,
    WeakSet,
    Symbol,
    Proxy,
    Reflect,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    ReferenceError,
    NaN,
    Infinity,
    undefined,
    // TextEncoder / TextDecoder
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    // URL / URLSearchParams
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
    // atob / btoa
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    // crypto for random UUID etc.
    crypto: globalThis.crypto,
  };

  return { ctx, logs, errors };
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

// ──────── JavaScript Sandbox (Node.js vm) ────────

export async function runJavaScript(
  code: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<SandboxResult> {
  const start = Date.now();
  const effectiveTimeout = Math.min(Math.max(1, timeoutMs), MAX_TIMEOUT_MS);
  const { ctx, logs, errors } = createSandboxContext();

  try {
    // Dynamic import for Node.js vm module
    const vm = await import("node:vm");

    const context = vm.createContext(ctx, {
      name: "codebuff-sandbox",
      codeGeneration: {
        wasm: false, // No WASM
      },
    });

    // Wrap in async function to support top-level await
    const wrappedCode = `(async () => { ${code} })()`;
    const script = new vm.Script(wrappedCode, {
      filename: "agent-code.js",
    });

    await script.runInContext(context, {
      timeout: effectiveTimeout,
      displayErrors: true,
    });

    return {
      stdout: truncate(logs.join("\n")),
      stderr: truncate(errors.join("\n")),
      exitCode: 0,
      durationMs: Date.now() - start,
      timedOut: false,
    };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.message.includes("timed out") || (err as NodeJS.ErrnoException).code === "ERR_SCRIPT_EXECTIMEOUT");

    const stderr = isTimeout
      ? `Execution timed out after ${effectiveTimeout}ms`
      : err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err);

    return {
      stdout: truncate(logs.join("\n")),
      stderr: truncate(stderr + (errors.length ? "\n" + errors.join("\n") : "")),
      exitCode: isTimeout ? 124 : 1,
      durationMs: Date.now() - start,
      timedOut: isTimeout,
    };
  }
}

// ──────── Python Sandbox (subprocess) ────────

/**
 * Run Python code in a subprocess with timeout and output limits.
 * Uses `python3 -c` with restricted imports where possible.
 */
export async function runPython(
  code: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<SandboxResult> {
  const start = Date.now();
  const effectiveTimeout = Math.min(Math.max(1, timeoutMs), MAX_TIMEOUT_MS);

  try {
    // Dynamic imports for Node.js child_process and util modules
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const { stdout, stderr } = await execFileAsync("python3", ["-c", code], {
      timeout: effectiveTimeout,
      maxBuffer: MAX_OUTPUT_BYTES,
      env: { ...process.env, HOME: "/tmp", PYTHONDONTWRITEBYTECODE: "1" } as NodeJS.ProcessEnv,
      encoding: "utf8",
    });

    return {
      stdout: truncate(stdout ?? ""),
      stderr: truncate(stderr ?? ""),
      exitCode: 0,
      durationMs: Date.now() - start,
      timedOut: false,
    };
  } catch (err: unknown) {
    // execFile rejects on non-zero exit code too — extract what we can
    const execErr = err as {
      code?: string;
      stdout?: string;
      stderr?: string;
      killed?: boolean;
      message?: string;
    };

    const timedOut = execErr.code === "ETIMEDOUT" || execErr.killed === true;

    return {
      stdout: truncate(execErr.stdout ?? ""),
      stderr: truncate(
        timedOut
          ? `Execution timed out after ${effectiveTimeout}ms`
          : execErr.stderr ?? execErr.message ?? "Python execution failed"
      ),
      exitCode: timedOut ? 124 : 1,
      durationMs: Date.now() - start,
      timedOut,
    };
  }
}
