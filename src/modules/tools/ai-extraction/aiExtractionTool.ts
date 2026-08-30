import { Tool } from "../interfaces/Tool";
import { getLLMProvider } from "@/providers/llm";
import {
  aiExtractionInputValidator,
  aiExtractionInputSchema,
  aiExtractionOutputSchema,
} from "../validators/aiExtraction";

interface ExtractionResult {
  data: Record<string, unknown>;
  confidence: number;
}

/**
 * Regex/pattern extractor used ONLY as a fallback when the LLM call itself fails
 * (provider outage, missing API key, malformed response). Never the primary path.
 */
function extractFieldsByRegexHeuristic(text: string, fields: string[]): ExtractionResult {
  const data: Record<string, unknown> = {};
  let matchedCount = 0;

  for (const field of fields) {
    const cleanField = field.trim();
    const regex = new RegExp(`(?:${cleanField}|${cleanField.replace(/([A-Z])/g, " $1")})\\s*[:=-]\\s*([^\\n,;]+)`, "i");
    const match = text.match(regex);
    if (match && match[1]) {
      const rawVal = match[1].trim();
      const numCleaned = rawVal.replace(/^[$€£¥₹]\s*/, "");
      if (/^-?\d+(\.\d+)?$/.test(numCleaned)) {
        data[cleanField] = parseFloat(numCleaned);
      } else if (rawVal.toLowerCase() === "true") {
        data[cleanField] = true;
      } else if (rawVal.toLowerCase() === "false") {
        data[cleanField] = false;
      } else {
        data[cleanField] = rawVal;
      }
      matchedCount++;
      continue;
    }

    if (/email/i.test(cleanField)) {
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        data[cleanField] = emailMatch[0];
        matchedCount++;
        continue;
      }
    }

    if (/amount|total|price|cost|fee/i.test(cleanField)) {
      const amountMatch = text.match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
      if (amountMatch) {
        data[cleanField] = parseFloat(amountMatch[1]);
        matchedCount++;
        continue;
      }
    }

    if (/id|invoice|order|account/i.test(cleanField)) {
      const idMatch = text.match(/\b([A-Z0-9]{4,12})\b/);
      if (idMatch) {
        data[cleanField] = idMatch[1];
        matchedCount++;
        continue;
      }
    }

    data[cleanField] = null;
  }

  // Confidence reflects the true match ratio — no artificial floor. A mostly-failed
  // extraction should report a low confidence, not a reassuring one.
  const confidence = fields.length > 0 ? Math.round((matchedCount / fields.length) * 100) / 100 : 1.0;
  return { data, confidence };
}

/**
 * Extracts structured fields from unstructured text using a real LLM call.
 * Falls back to regex/pattern heuristics only if the LLM call itself errors.
 */
async function extractFieldsFromText(
  text: string,
  fields: string[]
): Promise<ExtractionResult & { usedFallback: boolean; fallbackReason?: string }> {
  try {
    const llm = getLLMProvider();
    const completion = await llm.complete(
      [
        {
          role: "system",
          content:
            "You are a precise information-extraction engine. Extract exactly the requested fields from the given text. " +
            "If a field's value is not present in the text, set it to null. Never invent values that are not supported by the text. " +
            `Respond ONLY with strict JSON of the form {"data": {"<field>": <value or null>, ...one entry per requested field}, "confidence": 0.0-1.0}.`,
        },
        {
          role: "user",
          content: `Fields to extract: ${JSON.stringify(fields)}\n\nText:\n"""${text}"""`,
        },
      ],
      { temperature: 0, maxTokens: 500 }
    );

    const jsonMatch = completion.content.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Extraction LLM response did not contain JSON");
    const parsed = JSON.parse(jsonMatch[0]);

    const data: Record<string, unknown> = {};
    for (const field of fields) {
      const cleanField = field.trim();
      data[cleanField] =
        parsed.data && Object.prototype.hasOwnProperty.call(parsed.data, cleanField)
          ? parsed.data[cleanField]
          : null;
    }

    const nonNullCount = Object.values(data).filter((v) => v !== null && v !== undefined).length;
    const confidence =
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : fields.length > 0
          ? nonNullCount / fields.length
          : 1;

    return { data, confidence, usedFallback: false };
  } catch (err) {
    const fallback = extractFieldsByRegexHeuristic(text, fields);
    return {
      ...fallback,
      usedFallback: true,
      fallbackReason: err instanceof Error ? err.message : "unknown error",
    };
  }
}

export const aiExtractionTool: Tool = {
  id: "ai_extraction",
  name: "ai_extraction",
  displayName: "AI Extraction",
  description:
    "Extracts structured JSON entities and fields from unstructured text, documents, or prior step results using an LLM.",
  category: "DATA",
  type: "READ",
  inputSchema: aiExtractionInputSchema,
  outputSchema: aiExtractionOutputSchema,
  requiresApproval: false,
  enabled: true,

  validate(input) {
    const parsed = aiExtractionInputValidator.safeParse(input);
    if (parsed.success) return [];
    return parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  },

  async execute(input) {
    const parsed = aiExtractionInputValidator.parse(input);
    const { text, fieldsToExtract, sourceDocument } = parsed;

    const { data: extractedData, confidence: confidenceScore, usedFallback, fallbackReason } = await extractFieldsFromText(
      text,
      fieldsToExtract
    );

    return {
      extractedData,
      confidenceScore,
      sourceDocument: sourceDocument ?? "direct_payload",
      extractedFieldCount: Object.values(extractedData).filter((v) => v !== null).length,
      method: usedFallback ? "regex_heuristic_fallback" : "llm",
      ...(usedFallback ? { fallbackReason } : {}),
    };
  },

  async healthCheck() {
    const started = Date.now();
    try {
      await aiExtractionTool.execute({
        text: "Invoice #1092 Total: $450.00 Customer: Acme Corp",
        fieldsToExtract: ["Invoice", "Total", "Customer"],
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
