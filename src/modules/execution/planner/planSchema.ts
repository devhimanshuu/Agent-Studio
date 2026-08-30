import { z } from "zod";

const plannedStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  /** Tool name to invoke, or "none" for a data pass-through step. */
  toolName: z.string().min(1),
  action: z.string().min(1),
  input: z.record(z.unknown()),
  requiresApproval: z.boolean().default(false),
});

export const executionPlanSchema = z.object({
  reasoning: z.string().min(1),
  requiredTools: z.array(z.string().min(1)).max(20),
  steps: z.array(plannedStepSchema).min(0).max(100),
  expectedOutput: z.string().min(1),
});

