/**
 * Reference resolution for the linear execution engine.
 *
 * The LLM planner may reference the skill's user input or an earlier step's
 * output when building a later step's input (e.g. a second calculator call
 * that feeds on the first call's result). The engine accumulates step outputs
 * in `results` keyed `step_<n>`, and this module substitutes those references
 * into the input payload before the tool executes.
 *
 * Supported syntaxes (a value that is a SINGLE reference keeps the resolved
 * type so numeric inputs stay numbers):
 *   - `$step<N>.result`          — prior step output (unwraps `{ result }`)
 *   - `{{ step_<N>.result }}`    — prior step output, graph-template style
 *   - `{{ input.<path> }}`       — the skill's validated user input
 *   - `{{ <path> }}`             — user input shorthand (planner convention)
 *   - embedded occurrences of any of the above inside a larger string are
 *     interpolated as text (JSON for non-string values).
 */

const STEP_REF = /^\$step(\d+)\.result$/;
const BRACED_STEP_REF = /^\{\{\s*step_(\d+)\.result\s*\}\}$/;
const BRACED_INPUT_REF = /^\{\{\s*(?:input\.)?([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}$/;
const EMBEDDED_STEP_REF = /\$step(\d+)\.result|\{\{\s*step_(\d+)\.result\s*\}\}/g;
const EMBEDDED_INPUT_REF = /\{\{\s*(?:input\.)?([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}/g;

/** Context available to reference resolution. */
export interface StepReferenceContext {
  /** Step outputs keyed `step_<n>`. */
  results: Record<string, unknown>;
  /** The skill's validated user input. */
  userInput: Record<string, unknown>;
}

function getByPath(value: unknown, parts: string[]): unknown {
  let current = value;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Unwrap a `{ result: <scalar>, ... }` tool output to the scalar payload. */
function unwrapResult(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const resultProp = (value as Record<string, unknown>)["result"];
    if (resultProp !== undefined) return resultProp;
  }
  return value;
}

/**
 * Resolve a single reference token against the execution context.
 * Tools typically return structured outputs ({ action, expression, result }),
 * and the planner references the numeric payload as `$step<N>.result` — so a
 * step output that carries a `result` property resolves to that value.
 */
export function resolveStepReference(
  token: string,
  ctx: StepReferenceContext
): { resolved: unknown; found: boolean } {
  const stepMatch = token.match(STEP_REF) ?? token.match(BRACED_STEP_REF);
  if (stepMatch) {
    const stepNumber = stepMatch[1] ?? stepMatch[2];
    const value = ctx.results[`step_${stepNumber}`];
    return value === undefined ? { resolved: token, found: false } : { resolved: unwrapResult(value), found: true };
  }
  const inputMatch = token.match(BRACED_INPUT_REF);
  if (inputMatch) {
    const value = getByPath(ctx.userInput, inputMatch[1].split("."));
    return value === undefined ? { resolved: token, found: false } : { resolved: value, found: true };
  }
  return { resolved: token, found: false };
}

/**
 * Substitute references anywhere in a tool input payload. A value that is a
 * SINGLE reference keeps the resolved type; embedded references interpolate
 * as strings.
 */
export function resolveStepReferences(value: unknown, ctx: StepReferenceContext): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const single = resolveStepReference(trimmed, ctx);
    if (single.found) return single.resolved;
    if (!EMBEDDED_STEP_REF.test(value) && !EMBEDDED_INPUT_REF.test(value)) return value;
    EMBEDDED_STEP_REF.lastIndex = 0;
    EMBEDDED_INPUT_REF.lastIndex = 0;
    let out = value.replace(EMBEDDED_STEP_REF, (match, a?: string, b?: string) => {
      const stepNumber = a ?? b;
      const ref = unwrapResult(ctx.results[`step_${stepNumber}`]);
      if (ref === undefined) return match;
      return typeof ref === "string" ? ref : JSON.stringify(ref);
    });
    EMBEDDED_STEP_REF.lastIndex = 0;
    EMBEDDED_INPUT_REF.lastIndex = 0;
    out = out.replace(EMBEDDED_INPUT_REF, (match, path: string) => {
      const ref = getByPath(ctx.userInput, path.split("."));
      if (ref === undefined) return match;
      return typeof ref === "string" ? ref : JSON.stringify(ref);
    });
    EMBEDDED_STEP_REF.lastIndex = 0;
    EMBEDDED_INPUT_REF.lastIndex = 0;
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => resolveStepReferences(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = resolveStepReferences(v, ctx);
    }
    return out;
  }
  return value;
}
