import { z } from "zod";

export const createSkillSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  name: z.string().min(2, "Skill name must be at least 2 characters").max(100),
  purpose: z.string().min(5, "Purpose must be at least 5 characters").max(500),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  instructions: z.string().optional(),
  examples: z
    .array(
      z.object({
        input: z.record(z.unknown()),
        output: z.record(z.unknown()),
        description: z.string().optional(),
      })
    )
    .optional(),
  allowedTools: z.array(z.string()).optional(),
  actionsRequiringApproval: z.array(z.string()).optional(),
  maxExecutionSteps: z.number().int().min(1).max(50).optional(),
});

export const updateDraftSchema = createSkillSchema.partial();
