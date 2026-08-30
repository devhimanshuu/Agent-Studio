import { z } from "zod";
import { MAX_JSON_PAYLOAD_BYTES } from "@/lib/api/payloadValidation";
import { graphDefinitionSchema } from "./graphSchema";

// A JSON object must be a plain object (not array/null), JSON-serializable,
// and must not exceed the 1MB per-payload storage boundary.
const jsonSchema = z
  .record(z.string(), z.unknown())
  .refine((val) => val !== null && typeof val === "object" && !Array.isArray(val), {
    message: "Must be a valid JSON object",
  })
  .refine(
    (val) => {
      try {
        return Buffer.byteLength(JSON.stringify(val), "utf8") <= MAX_JSON_PAYLOAD_BYTES;
      } catch {
        return false;
      }
    },
    { message: "JSON object exceeds maximum size of 1MB" }
  );

const skillExampleSchema = z.object({
  input: jsonSchema,
  output: jsonSchema,
  description: z.string().max(300).optional(),
});

const approvalPolicySchema = z.object({
  alwaysRequireApproval: z.boolean(),
  neverRequireApproval: z.boolean(),
  toolBasedApproval: z.array(z.string().min(1)).max(20),
  skillBasedApproval: z.array(z.string().min(1)).max(20),
});

export const createSkillSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  name: z.string().min(2, "Skill name must be at least 2 characters").max(100, "Skill name must be at most 100 characters"),
  purpose: z.string().min(5, "Purpose must be at least 5 characters").max(1000, "Purpose must be at most 1000 characters"),
  inputSchema: jsonSchema.optional(),
  outputSchema: jsonSchema.optional(),
  instructions: z.string().min(5, "Instructions must be at least 5 characters").max(20000).optional(),
  examples: z.array(skillExampleSchema).max(50).optional(),
  allowedTools: z.array(z.string().min(1)).min(1, "At least one allowed tool is required").max(20),
  actionsRequiringApproval: z.array(z.string().min(1)).max(20).optional(),
  approvalPolicy: approvalPolicySchema.optional(),
  maxExecutionSteps: z.number().int("Must be a whole number").min(1, "Max execution steps must be greater than 0").max(100).optional(),
  graphDefinition: graphDefinitionSchema.optional(),
  notes: z.string().max(5000).optional(),
});

export const updateSkillSchema = createSkillSchema
  .omit({ userId: true })
  .partial()
  // Allow editing any subset, but keep the "at least one allowed tool" rule
  // when allowedTools is explicitly provided.
  .extend({
    allowedTools: z.array(z.string().min(1)).min(1, "At least one allowed tool is required").max(20).optional(),
  });

export const publishSkillSchema = z.object({
  versionId: z.string().min(1, "Version ID is required"),
});

export const skillListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  sortBy: z.enum(["updatedAt", "name", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

