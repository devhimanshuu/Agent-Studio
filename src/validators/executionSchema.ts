import { z } from "zod";

export const startExecutionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  skillVersionId: z.string().min(1, "Skill version ID is required"),
  inputData: z.record(z.unknown()),
});
