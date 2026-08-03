import { Tool } from "../interfaces/Tool";
import { CalculatorAction, calculatorInputValidator, calculatorInputSchema, calculatorOutputSchema } from "../validators/calculator";

/** Trim floating-point noise (0.30000000000000004 -> 0.3) without hiding
 * genuinely large results. */
function round(n: number): number {
  return Math.round(n * 1e10) / 1e10;
}

function describe(action: CalculatorAction, a: number, b: number | undefined): string {
  switch (action) {
    case "add":
      return `${a} + ${b} = ${round(a + (b ?? 0))}`;
    case "subtract":
      return `${a} - ${b} = ${round(a - (b ?? 0))}`;
    case "multiply":
      return `${a} × ${b} = ${round(a * (b ?? 1))}`;
    case "divide":
      return `${a} ÷ ${b} = ${round(a / (b as number))}`;
    case "percentage":
      return `${a}% of ${b} = ${round((a / 100) * (b as number))}`;
    case "power":
      return `${a} ^ ${b} = ${round(Math.pow(a, b as number))}`;
    case "sqrt":
      return `√${a} = ${round(Math.sqrt(a))}`;
  }
}

/**
 * Stateless compute tool: add, subtract, multiply, divide, percentage, power,
 * square root. Returns a structured `{ action, expression, result }` response.
 */
export const calculatorTool: Tool = {
  id: "calculator",
  name: "calculator",
  displayName: "Calculator",
  description:
    "Deterministic arithmetic — add, subtract, multiply, divide, percentage, power, and square root. Returns a structured result.",
  category: "COMPUTE",
  type: "READ",
  inputSchema: calculatorInputSchema,
  outputSchema: calculatorOutputSchema,
  requiresApproval: false,
  enabled: true,

  validate(input) {
    const parsed = calculatorInputValidator.safeParse(input);
    if (parsed.success) return [];
    return parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  },

  async execute(input) {
    const parsed = calculatorInputValidator.parse(input);
    const { action, a, b } = parsed;
    // Domain guarantees already enforced by the validator (b for non-sqrt,
    // b !== 0 for divide, a >= 0 for sqrt) — but keep the runtime defensive.
    if (action === "divide" && b === 0) throw new Error("Cannot divide by zero");
    if (action === "sqrt" && a < 0) throw new Error("Cannot take the square root of a negative number");

    let result: number;
    switch (action) {
      case "add":
        result = a + (b as number);
        break;
      case "subtract":
        result = a - (b as number);
        break;
      case "multiply":
        result = a * (b as number);
        break;
      case "divide":
        result = a / (b as number);
        break;
      case "percentage":
        result = (a / 100) * (b as number);
        break;
      case "power":
        result = Math.pow(a, b as number);
        break;
      case "sqrt":
        result = Math.sqrt(a);
        break;
    }

    return {
      action,
      expression: describe(action, a, b),
      result: round(result),
    };
  },

  async healthCheck() {
    const started = Date.now();
    try {
      await calculatorTool.execute({ action: "add", a: 1, b: 1 });
      return { status: "healthy", latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  },
};
