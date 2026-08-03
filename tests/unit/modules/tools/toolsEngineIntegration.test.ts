import { describe, it, expect } from "vitest";
import { ExecutionEngine } from "@/modules/execution/executor/executionEngine";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { PlannerService } from "@/modules/execution/planner/plannerService";
import { createToolRegistry } from "@/modules/tools";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { StubLLM } from "../helpers/stubLLM";
import { FakeExecutionRepo } from "../helpers/fakeExecutionRepo";
import { FakeApprovalRepo } from "../helpers/fakeApprovalRepo";

function makeSkill(): SkillDTO {
  return {
    id: "s1",
    userId: "u1",
    name: "Test Skill",
    purpose: "A test skill",
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeVersion(overrides: Partial<SkillVersionDTO> = {}): SkillVersionDTO {
  return {
    id: "v1",
    skillId: "s1",
    versionNumber: 1,
    status: "DRAFT",
    inputSchema: {},
    outputSchema: {},
    instructions: "Do the thing.",
    examples: [],
    allowedTools: ["calculator", "mock_task_creator"],
    actionsRequiringApproval: [],
    maxExecutionSteps: 10,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeEngine(plan: unknown, version: SkillVersionDTO) {
  const repo = new FakeExecutionRepo();
  const approvalRepo = new FakeApprovalRepo();
  const engine = new ExecutionEngine({
    toolRegistry: createToolRegistry(),
    permissionChecker: new PermissionChecker(),
    planner: new PlannerService(new StubLLM({ plan })),
    executionRepo: repo,
    approvalRepo,
    timeoutMs: 5_000,
  });
  return { engine, repo, approvalRepo };
}

describe("Execution engine with the real built-in tool registry", () => {
  it("executes a calculator plan end-to-end with a persisted SUCCESS call + duration", async () => {
    const plan = {
      reasoning: "Add the numbers.",
      requiredTools: ["calculator"],
      steps: [{ stepNumber: 1, toolName: "calculator", action: "add", input: { a: 2, b: 3 }, requiresApproval: false }],
      expectedOutput: "5",
    };
    const { engine, repo } = makeEngine(plan, makeVersion());

    const result = await engine.run({ executionId: "exec-1", skill: makeSkill(), version: makeVersion(), userInput: {} });

    expect(result.status).toBe("COMPLETED");
    expect(result.finalOutput?.results).toEqual({ step_1: { action: "add", expression: "2 + 3 = 5", result: 5 } });
    expect(repo.toolCalls).toHaveLength(1);
    expect(repo.toolCalls[0]).toMatchObject({ toolName: "calculator", status: "SUCCESS" });
    expect(repo.toolCalls[0].durationMs).toBeTypeOf("number");
  });

  it("pauses for approval when the WRITE tool contract requires it, even if the plan did not flag it", async () => {
    const plan = {
      reasoning: "Create a task.",
      requiredTools: ["mock_task_creator"],
      steps: [
        {
          stepNumber: 1,
          toolName: "mock_task_creator",
          action: "create",
          input: { title: "Refind #491" },
          requiresApproval: false, // plan forgot to flag it — the tool contract still pauses
        },
      ],
      expectedOutput: "created",
    };
    const version = makeVersion({ allowedTools: ["calculator", "mock_task_creator"] });
    const { engine, approvalRepo } = makeEngine(plan, version);

    const result = await engine.run({ executionId: "exec-2", skill: makeSkill(), version, userInput: {} });

    expect(result.status).toBe("PAUSED_FOR_APPROVAL");
    // The WRITE-tool pause must surface in the approval queue.
    expect(approvalRepo.requests).toHaveLength(1);
    expect(approvalRepo.requests[0]).toMatchObject({
      executionId: "exec-2",
      toolName: "mock_task_creator",
      action: "create",
      inputPayload: { title: "Refind #491" },
      status: "PENDING",
      idempotencyKey: "appr-exec-2-step-1",
    });
  });

  it("fails the run when a plan uses a tool the skill does not allow", async () => {
    const plan = {
      reasoning: "Look up records.",
      requiredTools: ["record_lookup"],
      steps: [{ stepNumber: 1, toolName: "record_lookup", action: "find", input: { entity: "employees" }, requiresApproval: false }],
      expectedOutput: "records",
    };
    const version = makeVersion({ allowedTools: ["calculator"] }); // record_lookup NOT allowed
    const { engine, repo } = makeEngine(plan, version);

    const result = await engine.run({ executionId: "exec-3", skill: makeSkill(), version, userInput: {} });

    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/Unauthorized tool/);
    expect(repo.statusUpdates[0].status).toBe("FAILED");
  });

  it("fails deterministically on invalid tool input (no retry, clean error)", async () => {
    const plan = {
      reasoning: "Divide by zero.",
      requiredTools: ["calculator"],
      steps: [{ stepNumber: 1, toolName: "calculator", action: "divide", input: { a: 1, b: 0 }, requiresApproval: false }],
      expectedOutput: "error",
    };
    const { engine, repo } = makeEngine(plan, makeVersion());

    const result = await engine.run({ executionId: "exec-4", skill: makeSkill(), version: makeVersion(), userInput: {} });

    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/Cannot divide by zero/);
    expect(repo.toolCalls[0].status).toBe("ERROR");
  });
});
