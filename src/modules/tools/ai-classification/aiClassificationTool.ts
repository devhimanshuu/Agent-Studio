import { Tool } from "../interfaces/Tool";
import { getLLMProvider } from "@/providers/llm";
import {
  aiClassificationInputValidator,
  aiClassificationInputSchema,
  aiClassificationOutputSchema,
} from "../validators/aiClassification";

interface ClassificationResult {
  assignedCategory: string;
  confidence: number;
  reasoning: string;
  scores: Record<string, number>;
}

/**
 * Keyword/heuristic classifier used ONLY as a fallback when the LLM call itself fails
 * (provider outage, missing API key, malformed response). Never the primary path.
 */
function classifyByKeywordHeuristic(input: string, categories: string[]): ClassificationResult {
  const normalizedInput = input.toLowerCase();
  const scores: Record<string, number> = {};

  for (const category of categories) {
    const catWords = category.toLowerCase().split(/[^a-z0-9]+/);
    let matchScore = 0.1;

    for (const word of catWords) {
      if (word.length > 2 && normalizedInput.includes(word)) {
        matchScore += 0.45;
      }
    }

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

  let topCategory = categories[0];
  let topScore = -1;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topCategory = cat;
    }
  }

  const confidence = Math.max(0.4, topScore);
  return {
    assignedCategory: topCategory,
    confidence,
    reasoning: `Classified as '${topCategory}' via keyword-overlap heuristic (${(confidence * 100).toFixed(0)}% confidence).`,
    scores,
  };
}

/**
 * Classifies text into one of the candidate categories using a real LLM call.
 * Falls back to a keyword heuristic only if the LLM call itself errors, and always
 * discloses that in the returned reasoning.
 */
async function classifyText(input: string, categories: string[], context?: string): Promise<ClassificationResult> {
  try {
    const llm = getLLMProvider();
    const completion = await llm.complete(
      [
        {
          role: "system",
          content:
            "You are a precise text classifier. Given input text and a list of candidate categories, choose exactly one best-fitting category. Respond ONLY with strict JSON of the form " +
            `{"category": "<one of the given categories, verbatim>", "confidence": 0.0-1.0, "reasoning": "one sentence explaining the decision", "scores": {"<category>": 0.0-1.0, ...one entry per candidate category}}.`,
        },
        {
          role: "user",
          content: `Candidate categories: ${JSON.stringify(categories)}${context ? `\nBusiness context: ${context}` : ""}\n\nText to classify:\n"""${input}"""`,
        },
      ],
      { temperature: 0, maxTokens: 400 }
    );

    const jsonMatch = completion.content.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Classifier LLM response did not contain JSON");
    const parsed = JSON.parse(jsonMatch[0]);

    const assignedCategory = categories.includes(parsed.category) ? parsed.category : categories[0];
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence)));
    const finalConfidence = Number.isFinite(confidence) ? confidence : 0.5;

    const scores: Record<string, number> = {};
    for (const cat of categories) {
      const raw = parsed.scores?.[cat];
      scores[cat] =
        typeof raw === "number" && Number.isFinite(raw)
          ? Math.max(0, Math.min(1, raw))
          : cat === assignedCategory
            ? finalConfidence
            : 0;
    }

    return {
      assignedCategory,
      confidence: finalConfidence,
      reasoning: String(parsed.reasoning || `Classified as '${assignedCategory}' by LLM.`),
      scores,
    };
  } catch (err) {
    const fallback = classifyByKeywordHeuristic(input, categories);
    return {
      ...fallback,
      reasoning: `[LLM classifier unavailable — used keyword heuristic fallback: ${err instanceof Error ? err.message : "unknown error"}] ${fallback.reasoning}`,
    };
  }
}

export const aiClassificationTool: Tool = {
  id: "ai_classification",
  name: "ai_classification",
  displayName: "AI Classification",
  description:
    "Classifies text, requests, or events into bounded discrete categories using an LLM, with confidence metrics and decision rationale.",
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
    const { input: text, categories, context } = parsed;

    const { assignedCategory, confidence, reasoning, scores } = await classifyText(text, categories, context);

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
