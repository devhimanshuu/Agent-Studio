import { z } from "zod";

export const RECORD_ENTITIES = [
  "employees",
  "customers",
  "orders",
  "banks",
  "audit_reports",
] as const;

export type RecordEntity = (typeof RECORD_ENTITIES)[number];

export const recordLookupInputValidator = z.object({
  entity: z.enum(RECORD_ENTITIES, { message: "Unknown record entity" }),
  /** Exact primary-key match (e.g. `EMP-001`). Takes precedence over search. */
  id: z.string().trim().min(1).optional(),
  /** Case-insensitive substring match across string fields. */
  search: z.string().trim().min(1).max(100).optional(),
  /** Maximum records to return. Default 10, capped at 50. */
  limit: z.number().int().min(1).max(50).optional(),
});

export const recordLookupInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    entity: { type: "string", enum: [...RECORD_ENTITIES] },
    id: { type: "string" },
    search: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: 50 },
  },
  required: ["entity"],
  additionalProperties: false,
};

export const recordLookupOutputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    entity: { type: "string" },
    query: { type: "string" },
    count: { type: "integer" },
    records: { type: "array", items: { type: "object" } },
  },
  required: ["entity", "query", "count", "records"],
};
