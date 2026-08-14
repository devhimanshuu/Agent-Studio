import { z } from "zod";

export const aiClassificationInputValidator = z.object({
  input: z.string({ message: "input must be a string" }).min(1, "input cannot be empty"),
  categories: z.array(z.string()).min(1, "At least one category is required"),
  context: z.string().optional(),
});

export type AIClassificationInput = z.infer<typeof aiClassificationInputValidator>;

export const aiClassificationInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    input: { type: "string", description: "Text or subject to classify" },
    categories: {
      type: "array",
      items: { type: "string" },
      description: "List of valid target categories (e.g. ['URGENT', 'STANDARD', 'INQUIRY', 'COMPLAINT', 'FRAUD_RISK'])",
    },
    context: { type: "string", description: "Optional business context or rules" },
  },
  required: ["input", "categories"],
  additionalProperties: false,
};

export const aiClassificationOutputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    assignedCategory: { type: "string", description: "The top assigned category" },
    confidence: { type: "number", description: "Confidence score between 0 and 1" },
    reasoning: { type: "string", description: "Explanation of why this classification was assigned" },
    categoryScores: { type: "object", description: "Scores distribution across evaluated categories" },
  },
  required: ["assignedCategory", "confidence", "reasoning"],
};
