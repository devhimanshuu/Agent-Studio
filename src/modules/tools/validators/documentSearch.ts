import { z } from "zod";

export const documentSearchInputValidator = z.object({
  query: z.string({ message: "query must be a string" }).trim().min(1, "query is required").max(200),
  /** Maximum number of ranked results to return. Default 5, capped at 10. */
  limit: z.number().int().min(1).max(10).optional(),
});

export const documentSearchInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    query: { type: "string", minLength: 1, maxLength: 200 },
    limit: { type: "integer", minimum: 1, maximum: 10 },
  },
  required: ["query"],
  additionalProperties: false,
};

export const documentSearchOutputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    query: { type: "string" },
    total: { type: "integer" },
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          snippet: { type: "string" },
          relevance: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["title", "snippet", "relevance"],
      },
    },
  },
  required: ["query", "total", "results"],
};
