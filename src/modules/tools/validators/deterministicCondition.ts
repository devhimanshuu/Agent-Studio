import { z } from "zod";

export const CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
  "contains",
  "not_contains",
  "in",
  "not_in",
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const conditionInputValidator = z.object({
  field: z.string({ message: "field name is required" }).min(1),
  operator: z.enum(CONDITION_OPERATORS, { message: "Invalid condition operator" }),
  threshold: z.any(),
  actualValue: z.any(),
  context: z.string().optional(),
});

export type ConditionInput = z.infer<typeof conditionInputValidator>;

export const conditionInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    field: { type: "string", description: "Name of the field being tested (e.g. 'amount', 'riskScore', 'status')" },
    operator: {
      type: "string",
      enum: [...CONDITION_OPERATORS],
      description: "Comparison operator to evaluate",
    },
    threshold: { description: "Target value / threshold to compare against" },
    actualValue: { description: "Actual value from the workflow state or prior step" },
    context: { type: "string", description: "Optional business rule note" },
  },
  required: ["field", "operator", "threshold", "actualValue"],
  additionalProperties: false,
};

export const conditionOutputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    conditionMet: { type: "boolean", description: "True if the rule evaluated to truthy" },
    decisionExplanation: {
      type: "string",
      description: "Clear deterministic explanation of why this decision path was chosen",
    },
    selectedBranch: { type: "string", enum: ["TRUE_BRANCH", "FALSE_BRANCH"] },
    evaluationDetails: {
      type: "object",
      properties: {
        field: { type: "string" },
        operator: { type: "string" },
        actualValue: {},
        threshold: {},
      },
    },
  },
  required: ["conditionMet", "decisionExplanation", "selectedBranch"],
};
