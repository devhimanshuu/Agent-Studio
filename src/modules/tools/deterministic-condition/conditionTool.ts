import { Tool } from "../interfaces/Tool";
import {
  conditionInputValidator,
  conditionInputSchema,
  conditionOutputSchema,
  ConditionOperator,
} from "../validators/deterministicCondition";

function evaluateCondition(
  field: string,
  operator: ConditionOperator,
  actualValue: unknown,
  threshold: unknown
): { conditionMet: boolean; decisionExplanation: string } {
  let conditionMet = false;
  let explanation = "";

  const actualNum = typeof actualValue === "number" ? actualValue : parseFloat(String(actualValue));
  const threshNum = typeof threshold === "number" ? threshold : parseFloat(String(threshold));
  const isNumeric = !isNaN(actualNum) && !isNaN(threshNum);

  switch (operator) {
    case "equals": {
      conditionMet = String(actualValue).toLowerCase() === String(threshold).toLowerCase();
      explanation = conditionMet
        ? `Field '${field}' (${actualValue}) equals target threshold (${threshold}).`
        : `Field '${field}' (${actualValue}) does not equal target threshold (${threshold}).`;
      break;
    }
    case "not_equals": {
      conditionMet = String(actualValue).toLowerCase() !== String(threshold).toLowerCase();
      explanation = conditionMet
        ? `Field '${field}' (${actualValue}) is not equal to '${threshold}'.`
        : `Field '${field}' matches '${threshold}'.`;
      break;
    }
    case "greater_than": {
      if (isNumeric) {
        conditionMet = actualNum > threshNum;
        explanation = conditionMet
          ? `Field '${field}' value ${actualNum} exceeds threshold ${threshNum}.`
          : `Field '${field}' value ${actualNum} does not exceed threshold ${threshNum}.`;
      } else {
        conditionMet = String(actualValue) > String(threshold);
        explanation = `String comparison: '${actualValue}' > '${threshold}' evaluated to ${conditionMet}.`;
      }
      break;
    }
    case "greater_than_or_equal": {
      if (isNumeric) {
        conditionMet = actualNum >= threshNum;
        explanation = conditionMet
          ? `Field '${field}' value ${actualNum} is >= threshold ${threshNum}.`
          : `Field '${field}' value ${actualNum} is strictly below threshold ${threshNum}.`;
      } else {
        conditionMet = String(actualValue) >= String(threshold);
        explanation = `String comparison: '${actualValue}' >= '${threshold}' evaluated to ${conditionMet}.`;
      }
      break;
    }
    case "less_than": {
      if (isNumeric) {
        conditionMet = actualNum < threshNum;
        explanation = conditionMet
          ? `Field '${field}' value ${actualNum} is below threshold ${threshNum}.`
          : `Field '${field}' value ${actualNum} is not below threshold ${threshNum}.`;
      } else {
        conditionMet = String(actualValue) < String(threshold);
        explanation = `String comparison: '${actualValue}' < '${threshold}' evaluated to ${conditionMet}.`;
      }
      break;
    }
    case "less_than_or_equal": {
      if (isNumeric) {
        conditionMet = actualNum <= threshNum;
        explanation = conditionMet
          ? `Field '${field}' value ${actualNum} is <= threshold ${threshNum}.`
          : `Field '${field}' value ${actualNum} exceeds threshold ${threshNum}.`;
      } else {
        conditionMet = String(actualValue) <= String(threshold);
        explanation = `String comparison: '${actualValue}' <= '${threshold}' evaluated to ${conditionMet}.`;
      }
      break;
    }
    case "contains": {
      const actStr = String(actualValue).toLowerCase();
      const thrStr = String(threshold).toLowerCase();
      conditionMet = actStr.includes(thrStr);
      explanation = conditionMet
        ? `Field '${field}' ('${actualValue}') contains substring '${threshold}'.`
        : `Field '${field}' ('${actualValue}') does not contain substring '${threshold}'.`;
      break;
    }
    case "not_contains": {
      const actStr = String(actualValue).toLowerCase();
      const thrStr = String(threshold).toLowerCase();
      conditionMet = !actStr.includes(thrStr);
      explanation = conditionMet
        ? `Field '${field}' does not contain '${threshold}'.`
        : `Field '${field}' contains '${threshold}'.`;
      break;
    }
    case "in": {
      const items = Array.isArray(threshold)
        ? threshold.map((v) => String(v).toLowerCase())
        : String(threshold).toLowerCase().split(",").map((s) => s.trim());
      conditionMet = items.includes(String(actualValue).toLowerCase());
      explanation = conditionMet
        ? `Field '${field}' (${actualValue}) is in permitted set [${items.join(", ")}].`
        : `Field '${field}' (${actualValue}) is NOT in permitted set [${items.join(", ")}].`;
      break;
    }
    case "not_in": {
      const items = Array.isArray(threshold)
        ? threshold.map((v) => String(v).toLowerCase())
        : String(threshold).toLowerCase().split(",").map((s) => s.trim());
      conditionMet = !items.includes(String(actualValue).toLowerCase());
      explanation = conditionMet
        ? `Field '${field}' (${actualValue}) is excluded from [${items.join(", ")}].`
        : `Field '${field}' (${actualValue}) was found in excluded set [${items.join(", ")}].`;
      break;
    }
  }

  const selectedBranch = conditionMet ? "TRUE_BRANCH" : "FALSE_BRANCH";
  const pathRationale = `[DECISION PATH: ${selectedBranch}] ${explanation}`;

  return { conditionMet, decisionExplanation: pathRationale };
}

export const deterministicConditionTool: Tool = {
  id: "deterministic_condition",
  name: "deterministic_condition",
  displayName: "Deterministic Condition Evaluator",
  description:
    "Evaluates deterministic business rules and conditions against workflow state, producing an auditable decision path explanation.",
  category: "COMPUTE",
  type: "READ",
  inputSchema: conditionInputSchema,
  outputSchema: conditionOutputSchema,
  requiresApproval: false,
  enabled: true,

  validate(input) {
    const parsed = conditionInputValidator.safeParse(input);
    if (parsed.success) return [];
    return parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  },

  async execute(input) {
    const parsed = conditionInputValidator.parse(input);
    const { field, operator, actualValue, threshold } = parsed;

    const { conditionMet, decisionExplanation } = evaluateCondition(
      field,
      operator,
      actualValue,
      threshold
    );

    return {
      conditionMet,
      decisionExplanation,
      selectedBranch: conditionMet ? "TRUE_BRANCH" : "FALSE_BRANCH",
      evaluationDetails: {
        field,
        operator,
        actualValue,
        threshold,
      },
    };
  },

  async healthCheck() {
    const started = Date.now();
    try {
      await deterministicConditionTool.execute({
        field: "amount",
        operator: "greater_than",
        actualValue: 1500,
        threshold: 1000,
      });
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
