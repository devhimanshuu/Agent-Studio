import { Tool } from "../interfaces/Tool";
import {
  aiClassificationInputValidator,
  aiClassificationInputSchema,
  aiClassificationOutputSchema,
} from "../validators/aiClassification";

/**
 * Classifies text into one of the candidate categories based on semantic keyword density and heuristics.
 */
function classifyText(input: string, categories: string[]): {
  assignedCategory: string;
  confidence: number;
  reasoning: string;
  scores: Record<string, number>;
} {
  const normalizedInput = input.toLowerCase();
  const scores: Record<string, number> = {};

  for (const category of categories) {
    const catWords = category.toLowerCase().split(/[^a-z0-9]+/);
    let matchScore = 0.1; // base baseline score

    for (const word of catWords) {
      if (word.length > 2 && normalizedInput.includes(word)) {
        matchScore += 0.45;
      }
    }

    // Additional sentiment / priority heuristics
    if (category.toLowerCase().includes("urgent") || category.toLowerCase().includes("high")) {
      if (/\b(urgent|immediately|asap|critical|emergency|blocked)\b/i.test(input)) matchScore += 0.6;
    }
    if (category.toLowerCase().includes("fraud") || category.toLowerCase().includes("risk")) {
      if (/\b(fraud|suspicious|unauthorized|stolen|breach|chargeback)\b/i.test(input)) matchScore += 0.7;
    }
    if (category.toLowerCase().includes("refund") || category.toLowerCase().includes("billing")) {
      if (/\b(refund|charge|payment|invoice|bill|money|card|receipt)\b/i.test(input)) matchScore += 0.5;
    }

    scores[category] = Math.min(0.99, Math.round(matchScore * 100) / 100);
  }

  // Find top category
  let topCategory = categories[0];
  let topScore = -1;

  for (const [cat, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topCategory = cat;
    }
  }

  const confidence = Math.max(0.65, topScore);
  const reasoning = `Classified as '${topCategory}' with confidence ${(confidence * 100).toFixed(0)}% based on matching keywords and intent patterns in input text.`;

  return {
    assignedCategory: topCategory,
    confidence,
    reasoning,
    scores,
  };
}

export const aiClassificationTool: Tool = {
  id: "ai_classification",
  name: "ai_classification",
  displayName: "AI Classification",
  description:
    "Classifies text, requests, or events into bounded discrete categories with confidence metrics and decision rationale.",
  category: "DATA",
  type: "READ",
  inputSchema: aiClassificationInputSchema,
  outputSchema: aiClassificationOutputSchema,
  requiresApproval: false,
  enabled: true,

  validate(input) {
    const parsed = aiClassificationInputValidator.safeParse(input);
    if (parsed.success) return [];
    return parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  },

  async execute(input) {
    const parsed = aiClassificationInputValidator.parse(input);
    const { input: text, categories } = parsed;

    const { assignedCategory, confidence, reasoning, scores } = classifyText(text, categories);

    return {
      assignedCategory,
      confidence,
      reasoning,
      categoryScores: scores,
    };
  },

  async healthCheck() {
    const started = Date.now();
    try {
      await aiClassificationTool.execute({
        input: "Customer requested a full refund immediately due to billing error",
        categories: ["REFUND", "GENERAL_INQUIRY", "TECHNICAL_SUPPORT"],
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
