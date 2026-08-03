import { describe, it, expect } from "vitest";
import { ExecutionEngine } from "@/modules/execution/executor/executionEngine";
import { ToolRegistry } from "@/modules/tools";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { PlannerService } from "@/modules/execution/planner/plannerService";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { StubLLM } from "./helpers/stubLLM";
import { FakeExecutionRepo } from "./helpers/fakeExecutionRepo";
import { FakeApprovalRepo } from "./helpers/fakeApprovalRepo";
import { makeTool } from "./tools/helpers/makeTool";

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
    allowedTools: ["calculator"],
    actionsRequiringApproval: [],
    maxExecutionSteps: 10,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeRegistry() {
  const registry = new ToolRegistry();
  registry.registerTool(
    makeTool({
      name: "calculator",
      description: "Adds two numbers",
      inputSchema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } } },
      execute: async (input) => Number(input.a) + Number(input.b),
    })
  );
  return registry;
}

function makeEngine(plan: unknown, version: SkillVersionDTO) {
  const repo = new FakeExecutionRepo();
  const approvalRepo = new FakeApprovalRepo();
  const engine = new ExecutionEngine({
    toolRegistry: makeRegistry(),
    permissionChecker: new PermissionChecker(),
    planner: new PlannerService(new StubLLM({ plan })),
    executionRepo: repo,
    approvalRepo,
    timeoutMs: 5_000,
  });
  return { engine, repo, approvalRepo };
}

describe("ExecutionEngine (graph-first runtime)", () => {
  it("runs the graph to completion and returns the tool output", async () => {
    const plan = {
      reasoning: "Add the numbers.",
      requiredTools: ["calculator"],
      steps: [{ stepNumber: 1, toolName: "calculator", action: "add", input: { a: 2, b: 3 }, requiresApproval: false }],
      expectedOutput: "5",
    };
    const { engine, repo } = makeEngine(plan, makeVersion());

    const result = await engine.run({
      executionId: "exec-1",
      skill: makeSkill(),
      version: makeVersion(),
      userInput: {},
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.finalOutput?.results).toEqual({ step_1: 5 });
    expect(result.finalOutput?.expectedOutput).toBe("5");
    expect(result.providerUsed).toBe("stub/stub-model");
    // Every graph node persisted a timeline step + the tool call was recorded.
    expect(repo.steps.map((s) => s.nodeName)).toContain("planner");
    expect(repo.steps.map((s) => s.nodeName)).toContain("tool_execution");
    expect(repo.steps.map((s) => s.nodeName)).toContain("finish");
    expect(repo.toolCalls).toHaveLength(1);
    expect(repo.toolCalls[0].status).toBe("SUCCESS");
  });

  it("rejects an unauthorized tool and fails the run", async () => {
    const plan = {
      reasoning: "Use a secret tool.",
      requiredTools: ["ghost"],
      steps: [{ stepNumber: 1, toolName: "ghost", action: "read", input: {}, requiresApproval: false }],
      expectedOutput: "x",
    };
    const { engine, repo } = makeEngine(plan, makeVersion({ allowedTools: [] }));

    const result = await engine.run({
      executionId: "exec-2",
      skill: makeSkill(),
      version: makeVersion({ allowedTools: [] }),
      userInput: {},
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/Unauthorized tool/);
    expect(repo.statusUpdates[0].status).toBe("FAILED");
  });

  it("pauses for approval when a planned action requires it and creates the ApprovalRequest", async () => {
    const plan = {
      reasoning: "Create a record.",
      requiredTools: ["calculator"],
      steps: [{ stepNumber: 1, toolName: "calculator", action: "create_record", input: { note: "x" }, requiresApproval: false }],
      expectedOutput: "done",
    };
    const version = makeVersion({ actionsRequiringApproval: ["create_record"] });
    const { engine, approvalRepo } = makeEngine(plan, version);

    const result = await engine.run({
      executionId: "exec-3",
      skill: makeSkill(),
      version,
      userInput: {},
    });

    expect(result.status).toBe("PAUSED_FOR_APPROVAL");
    // The queue + respond API only work if the pause persisted a request.
    expect(approvalRepo.requests).toHaveLength(1);
    expect(approvalRepo.requests[0]).toMatchObject({
      executionId: "exec-3",
      userId: "u1",
      toolName: "calculator",
      action: "create_record",
      inputPayload: { note: "x" },
      status: "PENDING",
      idempotencyKey: "appr-exec-3-step-1",
    });
  });

  it("does not duplicate the ApprovalRequest when the same step pauses again", async () => {
    const plan = {
      reasoning: "Create a record.",
      requiredTools: ["calculator"],
      steps: [{ stepNumber: 1, toolName: "calculator", action: "create_record", input: {}, requiresApproval: false }],
      expectedOutput: "done",
    };
    const version = makeVersion({ actionsRequiringApproval: ["create_record"] });
    const { engine, approvalRepo } = makeEngine(plan, version);

    await engine.run({ executionId: "exec-3b", skill: makeSkill(), version, userInput: {} });
    await engine.run({ executionId: "exec-3b", skill: makeSkill(), version, userInput: {} });

    expect(approvalRepo.requests).toHaveLength(1);
  });

  it("fails with STEP_LIMIT_EXCEEDED when the plan exceeds maxExecutionSteps", async () => {
    const plan = {
      reasoning: "Too many steps.",
      requiredTools: ["calculator"],
      steps: [
        { stepNumber: 1, toolName: "calculator", action: "add", input: { a: 1, b: 1 }, requiresApproval: false },
        { stepNumber: 2, toolName: "calculator", action: "add", input: { a: 1, b: 1 }, requiresApproval: false },
      ],
      expectedOutput: "2",
    };
    const version = makeVersion({ maxExecutionSteps: 1 });
    const { engine, repo } = makeEngine(plan, version);

    const result = await engine.run({
      executionId: "exec-4",
      skill: makeSkill(),
      version,
      userInput: {},
    });

    expect(result.status).toBe("STEP_LIMIT_EXCEEDED");
    expect(repo.statusUpdates[0].status).toBe("STEP_LIMIT_EXCEEDED");
  });

  it("fails when a tool execution errors", async () => {
    const registry = new ToolRegistry();
    registry.registerTool(
      makeTool({
        name: "calculator",
        description: "Throws",
        execute: async () => {
          throw new Error("division by zero");
        },
      })
    );
    const repo = new FakeExecutionRepo();
    const engine = new ExecutionEngine({
      toolRegistry: registry,
      permissionChecker: new PermissionChecker(),
      planner: new PlannerService(
        new StubLLM({
          plan: {
            reasoning: "r",
            requiredTools: ["calculator"],
            steps: [{ stepNumber: 1, toolName: "calculator", action: "add", input: { a: 1, b: 2 }, requiresApproval: false }],
            expectedOutput: "3",
          },
        })
      ),
      executionRepo: repo,
      approvalRepo: new FakeApprovalRepo(),
      timeoutMs: 5_000,
    });

    const result = await engine.run({
      executionId: "exec-5",
      skill: makeSkill(),
      version: makeVersion(),
      userInput: {},
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/Tool "calculator" failed/);
    expect(repo.toolCalls[0].status).toBe("ERROR");
  });

  it("does not overwrite the user-cancellation message with a generic one", async () => {
    const plan = {
      reasoning: "r",
      requiredTools: ["calculator"],
      steps: [{ stepNumber: 1, toolName: "calculator", action: "add", input: { a: 1, b: 1 }, requiresApproval: false }],
      expectedOutput: "2",
    };
    const { engine, repo } = makeEngine(plan, makeVersion());
    const controller = new AbortController();
    controller.abort(); // user already requested cancellation

    const result = await engine.run({
      executionId: "exec-cancel",
      skill: makeSkill(),
      version: makeVersion(),
      userInput: {},
      signal: controller.signal,
    });

    expect(result.status).toBe("CANCELLED");
    const last = repo.statusUpdates[repo.statusUpdates.length - 1];
    expect(last.status).toBe("CANCELLED");
    // ExecutionService writes "User requested cancellation"; the engine must
    // not clobber it with the generic unwinding message.
    expect(last.error).toBeUndefined();
  });

  it("persists runtime details (provider, plan, duration) on success", async () => {
    const plan = {
      reasoning: "No-op plan.",
      requiredTools: [],
      steps: [],
      expectedOutput: "nothing",
    };
    const { engine, repo } = makeEngine(plan, makeVersion());

    await engine.run({ executionId: "exec-6", skill: makeSkill(), version: makeVersion(), userInput: {} });

    const details = repo.runtimeDetails[repo.runtimeDetails.length - 1];
    expect(details.details.provider).toBe("stub/stub-model");
    expect(details.details.plannerOutput).toBeDefined();
    expect(details.details.durationMs).toBeTypeOf("number");
  });
});
