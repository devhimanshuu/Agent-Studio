import { z } from "zod";

export const aiExtractionInputValidator = z.object({
  text: z.string({ message: "text must be a string" }).min(1, "text cannot be empty"),
  fieldsToExtract: z.array(z.string()).min(1, "At least one field to extract is required"),
  sourceDocument: z.string().optional(),
});

export type AIExtractionInput = z.infer<typeof aiExtractionInputValidator>;

export const aiExtractionInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    text: { type: "string", description: "Raw text or document payload to extract structured fields from" },
    fieldsToExtract: {
      type: "array",
      items: { type: "string" },
      description: "List of field names or keys to extract (e.g. ['customerName', 'amount', 'invoiceDate', 'riskLevel'])",
    },
    sourceDocument: { type: "string", description: "Optional document identifier or reference" },
  },
  required: ["text", "fieldsToExtract"],
  additionalProperties: false,
};

export const aiExtractionOutputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    extractedData: { type: "object", description: "Key-value map of extracted fields" },
    confidenceScore: { type: "number", description: "Confidence score between 0 and 1" },
    sourceDocument: { type: "string" },
    extractedFieldCount: { type: "number" },
    method: { type: "string", description: "'llm' when the LLM extractor was used, 'regex_heuristic_fallback' if the LLM call failed" },
  },
  required: ["extractedData", "confidenceScore", "extractedFieldCount"],
};
