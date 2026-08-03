import { z } from "zod";

export const CALCULATOR_ACTIONS = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "percentage",
  "power",
  "sqrt",
] as const;

export type CalculatorAction = (typeof CALCULATOR_ACTIONS)[number];

export const calculatorInputValidator = z
  .object({
    action: z.enum(CALCULATOR_ACTIONS, { message: "Unknown calculator action" }),
    /** First operand — required for every action. */
    a: z.number({ message: "a must be a number" }).finite(),
    /** Second operand — required except for `sqrt`. */
    b: z.number({ message: "b must be a number" }).finite().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === "sqrt" && val.a < 0) {
      ctx.addIssue({ code: "custom", message: "Cannot take the square root of a negative number" });
    }
    if (val.action === "divide" && val.b === 0) {
      ctx.addIssue({ code: "custom", message: "Cannot divide by zero" });
    }
    if (val.action !== "sqrt" && val.b === undefined) {
      ctx.addIssue({ code: "custom", message: `Action "${val.action}" requires a second operand (b)` });
    }
  });

/** JSON Schema mirror of the Zod validator (used by the catalog + details UI). */
export const calculatorInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    action: { type: "string", enum: [...CALCULATOR_ACTIONS] },
    a: { type: "number" },
    b: { type: "number" },
  },
  required: ["action", "a"],
  additionalProperties: false,
};

export const calculatorOutputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    action: { type: "string" },
    expression: { type: "string" },
    result: { type: "number" },
  },
  required: ["action", "expression", "result"],
};
