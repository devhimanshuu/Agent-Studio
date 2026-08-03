import { Tool } from "../interfaces/Tool";
import {
  mockTaskCreatorInputValidator,
  mockTaskCreatorInputSchema,
  mockTaskCreatorOutputSchema,
} from "../validators/mockTaskCreator";

function generateTaskId(): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `TASK-${rand.toUpperCase()}`;
}

/**
 * WRITE tool — simulates creating a task. No real persistence: returns the
 * generated taskId, status, title, and createdAt. Because it mutates
 * (simulated) state, `requiresApproval` is true and every invocation pauses
 * for human approval in the runtime.
 */
export const mockTaskCreatorTool: Tool = {
  id: "mock_task_creator",
  name: "mock_task_creator",
  displayName: "Mock Task Creator",
  description:
    "Simulates creating a task — generates a taskId and returns the created task. No real persistence. WRITE action: requires human approval.",
  category: "TASK",
  type: "WRITE",
  inputSchema: mockTaskCreatorInputSchema,
  outputSchema: mockTaskCreatorOutputSchema,
  requiresApproval: true,
  enabled: true,

  validate(input) {
    const parsed = mockTaskCreatorInputValidator.safeParse(input);
    if (parsed.success) return [];
    return parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  },

  async execute(input) {
    const parsed = mockTaskCreatorInputValidator.parse(input);
    return {
      taskId: generateTaskId(),
      status: "CREATED",
      title: parsed.title,
      priority: parsed.priority ?? "medium",
      createdAt: new Date().toISOString(),
      ...(parsed.description ? { description: parsed.description } : {}),
      ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
    };
  },

  async healthCheck() {
    const started = Date.now();
    try {
      await mockTaskCreatorTool.execute({ title: "health check" });
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
