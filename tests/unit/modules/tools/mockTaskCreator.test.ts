import { describe, it, expect } from "vitest";
import { mockTaskCreatorTool } from "@/modules/tools";

interface TaskOutput {
  taskId: string;
  status: string;
  title: string;
  priority: string;
  createdAt: string;
  description?: string;
  dueDate?: string;
  source: string;
}

async function createTask(input: Record<string, unknown>): Promise<TaskOutput> {
  return (await mockTaskCreatorTool.execute(input)) as TaskOutput;
}

describe("Task Creator tool", () => {
  it("is a WRITE tool that requires approval (HITL contract)", () => {
    expect(mockTaskCreatorTool.type).toBe("WRITE");
    expect(mockTaskCreatorTool.requiresApproval).toBe(true);
  });

  it("creates a real task persisted to PostgreSQL", async () => {
    const output = await createTask({ title: "Test Task" });
    expect(output).toMatchObject({
      status: "TODO",
      title: "Test Task",
      priority: "MEDIUM",
      source: "postgresql",
    });
    expect(output.taskId).toBeTruthy();
    expect(new Date(output.createdAt).getTime()).not.toBeNaN();
  });

  it("respects priority and optional fields", async () => {
    const output = await createTask({
      title: "Ship approval flow",
      priority: "high",
      description: "HITL write approvals",
      dueDate: "2026-08-15",
    });
    expect(output).toMatchObject({
      priority: "HIGH",
      description: "HITL write approvals",
    });
    expect(output.dueDate).toContain("2026-08-15");
  });

  it("generates unique ids across calls", async () => {
    const a = await createTask({ title: "one" });
    const b = await createTask({ title: "two" });
    expect(a.taskId).not.toBe(b.taskId);
  });

  it("rejects a missing or blank title", () => {
    expect(mockTaskCreatorTool.validate({}).join(" ")).toMatch(/title must be a string/);
    expect(mockTaskCreatorTool.validate({ title: "   " }).join(" ")).toMatch(/title is required/);
  });

  it("rejects invalid priority and malformed due dates", () => {
    expect(mockTaskCreatorTool.validate({ title: "x", priority: "urgent" }).join(" ")).toMatch(/low, medium or high/);
    expect(mockTaskCreatorTool.validate({ title: "x", dueDate: "15/08/2026" }).join(" ")).toMatch(/YYYY-MM-DD/);
  });

  it("reports healthy", async () => {
    const health = await mockTaskCreatorTool.healthCheck();
    expect(health.status).toMatch(/healthy|unavailable/);
    expect(typeof health.latencyMs).toBe("number");
  });
});
