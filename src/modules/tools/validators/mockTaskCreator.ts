import { z } from "zod";

const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export const mockTaskCreatorInputValidator = z.object({
  title: z.string({ message: "title must be a string" }).trim().min(1, "title is required").max(120),
  description: z.string().trim().max(500).optional(),
  priority: z.enum(TASK_PRIORITIES, { message: "priority must be low, medium or high" }).optional(),
  /** ISO date, `YYYY-MM-DD`. */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .optional(),
});

export const mockTaskCreatorInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: "string", maxLength: 500 },
    priority: { type: "string", enum: [...TASK_PRIORITIES] },
    dueDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
  required: ["title"],
  additionalProperties: false,
};

export const mockTaskCreatorOutputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    taskId: { type: "string" },
    status: { type: "string" },
    title: { type: "string" },
    priority: { type: "string" },
    createdAt: { type: "string" },
  },
  required: ["taskId", "status", "title", "createdAt"],
};
