import { Tool } from "../interfaces/Tool";
import {
  aiExtractionInputValidator,
  aiExtractionInputSchema,
  aiExtractionOutputSchema,
} from "../validators/aiExtraction";

/**
 * Helper to extract key-value fields from unstructured or semi-structured text.
 * Parses common patterns (e.g., "Field: Value", "amount: $100", email addresses, numbers, etc.).
 */
function extractFieldsFromText(text: string, fields: string[]): { data: Record<string, unknown>; confidence: number } {
  const data: Record<string, unknown> = {};
  let matchedCount = 0;

  for (const field of fields) {
    const cleanField = field.trim();
    // 1. Try exact label match "Field: Value" or "Field = Value"
    const regex = new RegExp(`(?:${cleanField}|${cleanField.replace(/([A-Z])/g, " $1")})\\s*[:=-]\\s*([^\\n,;]+)`, "i");
    const match = text.match(regex);
    if (match && match[1]) {
      const rawVal = match[1].trim();
      const numCleaned = rawVal.replace(/^[$€£¥₹]\s*/, "");
      // Parse numeric or boolean values if applicable
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


    // 2. Specific pattern heuristics for common business fields
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

    // Fallback: indicate field was searched
    data[cleanField] = null;
  }

  const confidence = fields.length > 0 ? Math.round((matchedCount / fields.length) * 100) / 100 : 1.0;
  return { data, confidence: Math.max(0.5, confidence) };
}

export const aiExtractionTool: Tool = {
  id: "ai_extraction",
  name: "ai_extraction",
  displayName: "AI Extraction",
  description:
    "Extracts structured JSON entities and fields from unstructured text, documents, or prior step results.",
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

    const { data: extractedData, confidence: confidenceScore } = extractFieldsFromText(text, fieldsToExtract);

    return {
      extractedData,
      confidenceScore,
      sourceDocument: sourceDocument ?? "direct_payload",
      extractedFieldCount: Object.values(extractedData).filter((v) => v !== null).length,
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
