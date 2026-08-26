import { Tool } from "../interfaces/Tool";
import {
  mockTaskCreatorInputValidator,
  mockTaskCreatorInputSchema,
  mockTaskCreatorOutputSchema,
} from "../validators/mockTaskCreator";

/**
 * Real task creator tool — persists tasks to PostgreSQL via Prisma.
 *
 * Tasks are stored in the `tasks` table and can be queried, updated, and
 * managed through the Task Management dashboard or via API.
 */
export const mockTaskCreatorTool: Tool = {
  id: "mock_task_creator",
  name: "mock_task_creator",
  displayName: "Task Creator",
  description:
    "Create real tasks persisted to PostgreSQL. Tasks include title, description, priority, due date, and status tracking.",
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

    const { prisma } = await import("@/lib/prisma");

    // Map priority string to enum
    const priorityMap: Record<string, "LOW" | "MEDIUM" | "HIGH" | "URGENT"> = {
      low: "LOW",
      medium: "MEDIUM",
      high: "HIGH",
      urgent: "URGENT",
    };

    // Create real task in PostgreSQL
    const task = await prisma.task.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        priority: priorityMap[parsed.priority ?? "medium"] ?? "MEDIUM",
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        status: "TODO",
      },
    });

    return {
      taskId: task.id,
      status: task.status,
      title: task.title,
      priority: task.priority,
      createdAt: task.createdAt.toISOString(),
      ...(task.description ? { description: task.description } : {}),
      ...(task.dueDate ? { dueDate: task.dueDate.toISOString().split("T")[0] } : {}),
      source: "postgresql",
    };
  },

  async healthCheck() {
    const started = Date.now();
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
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
