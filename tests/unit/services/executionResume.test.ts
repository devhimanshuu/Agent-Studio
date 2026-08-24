import { describe, it, expect } from "vitest";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionEngine } from "@/modules/execution/executor/executionEngine";
import { ApprovalEngine } from "@/modules/approval";
import { IApprovalHistoryRepository } from "@/repositories/interfaces/IApprovalHistoryRepository";
import { FakeExecutionRepo } from "../modules/helpers/fakeExecutionRepo";
import { FakeSkillRepo } from "../modules/helpers/fakeSkillRepo";
import { FakeAuditRepo } from "../modules/helpers/fakeAuditRepo";
import { FakeApprovalRepo } from "../modules/helpers/fakeApprovalRepo";
import { FakeLogRepo } from "../modules/helpers/fakeLogRepo";

/** Minimal in-memory history repo for the approval engine. */
class FakeHistoryRepo implements IApprovalHistoryRepository {
  entries: { approvalId: string; executionId: string; userId: string; action: string; details: Record<string, unknown>; timestamp: Date }[] = [];

  async log(input: {
    approvalId: string;
    executionId: string;
    userId: string;
    action: "CREATED" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED" | "RESUMED";
    details: Record<string, unknown>;
  }) {
    const entry = { ...input, timestamp: new Date() };
    this.entries.push(entry);
    return entry as never;
  }

  async findByApprovalId(approvalId: string) {
    return this.entries.filter((e) => e.approvalId === approvalId) as never;
  }

  async findByExecutionId(executionId: string) {
    return this.entries.filter((e) => e.executionId === executionId) as never;
  }
}

describe("ExecutionService.resumeExecution", () => {
  it("restores the persisted plan + progress instead of restarting the graph", async () => {
    const execRepo = new FakeExecutionRepo();
    const skillRepo = new FakeSkillRepo();
    const auditRepo = new FakeAuditRepo();
    const approvalRepo = new FakeApprovalRepo();
    const logRepo = new FakeLogRepo();

    const skill = await skillRepo.create({
      userId: "u1",
      name: "Incident Triage",
      purpose: "x",
      allowedTools: ["calculator"],
    });
    const version = (await skillRepo.findVersionsBySkillId(skill.id))[0];

    // A paused execution with a persisted plan + one executed step.
    const execution = await execRepo.create(
      { userId: "u1", skillVersionId: version.id, inputData: { issue: "p1" } },
      10,
      "Incident Triage"
    );
    await execRepo.updateStatus(execution.id, "PAUSED_FOR_APPROVAL");
    await execRepo.setRuntimeDetails(execution.id, {
      provider: "groq/llama-3.3-70b-versatile",
      plannerOutput: {
        reasoning: "Two steps.",
        requiredTools: ["calculator"],
        steps: [
          { stepNumber: 1, toolName: "calculator", action: "add", input: { a: 1, b: 2 }, requiresApproval: false },
          { stepNumber: 2, toolName: "calculator", action: "create", input: { note: "x" }, requiresApproval: true },
        ],
        expectedOutput: "done",
      },
    });
    await execRepo.addToolCall(execution.id, {
      toolName: "calculator",
      action: "add",
      inputArgs: { a: 1, b: 2 },
      outputResult: { result: 3 },
      status: "SUCCESS",
      durationMs: 5,
    });
    await execRepo.addStep(execution.id, {
      stepNumber: 1,
      nodeName: "planner",
      stateSnapshot: {},
      status: "SUCCESS",
      startedAt: new Date(),
      completedAt: new Date(),
    });
    await execRepo.addStep(execution.id, {
      stepNumber: 2,
      nodeName: "permission",
      stateSnapshot: {},
      status: "SUCCESS",
      startedAt: new Date(),
      completedAt: new Date(),
    });

    // The fake stores tool calls in a side array — attach them to the DTO the
    // same way the real repository's findByIdForUser include does.
    const stored = execRepo.executions.get(execution.id);
    if (stored) stored.toolCalls = execRepo.toolCalls;

    const engineInputs: unknown[] = [];
    const spyEngine = {
      run: async (input: unknown) => {
        engineInputs.push(input);
        return { status: "COMPLETED", finalOutput: { results: { step_1: { result: 3 }, step_2: { note: "x" } } }, providerUsed: "groq/x", plan: null };
      },
    } as unknown as ExecutionEngine;

    const service = new ExecutionService(execRepo, skillRepo, auditRepo, {
      approvalRepo,
      logRepo,
      engine: spyEngine,
    });

    const result = await service.resumeExecution(execution.id, "u1");
    expect(result.id).toBe(execution.id);

    const resume = (engineInputs[0] as { resume?: unknown }).resume as
      | { plan: { steps: unknown[] }; currentStep: number; results: Record<string, unknown>; persistedStepCount: number }
      | undefined;
    expect(resume).toBeDefined();
    // Plan restored (not regenerated), progress preserved: 1 step already done.
    expect(resume?.plan.steps).toHaveLength(2);
    expect(resume?.currentStep).toBe(1);
    // Prior result restored so the finish node can assemble complete output.
    expect(resume?.results).toEqual({ step_1: { result: 3 } });
    // Node-step numbering continues from the persisted counter.
    expect(resume?.persistedStepCount).toBe(2);
  });

  it("persists COMPLETED + finalOutput when the resumed run succeeds (regression)", async () => {
    const execRepo = new FakeExecutionRepo();
    const skillRepo = new FakeSkillRepo();
    const auditRepo = new FakeAuditRepo();
    const approvalRepo = new FakeApprovalRepo();
    const logRepo = new FakeLogRepo();

    const skill = await skillRepo.create({ userId: "u1", name: "S", purpose: "p", allowedTools: ["calculator"] });
    const version = (await skillRepo.findVersionsBySkillId(skill.id))[0];
    const execution = await execRepo.create(
      { userId: "u1", skillVersionId: version.id, inputData: {} },
      10,
      "S"
    );
    await execRepo.updateStatus(execution.id, "PAUSED_FOR_APPROVAL");
    await execRepo.setRuntimeDetails(execution.id, {
      provider: "groq/x",
      plannerOutput: {
        reasoning: "r",
        requiredTools: ["calculator"],
        steps: [{ stepNumber: 1, toolName: "calculator", action: "create", input: { note: "x" }, requiresApproval: true }],
        expectedOutput: "done",
      },
    });

    // Engine resolves COMPLETED (what a successful resumed graph run returns).
    const engine = {
      run: async () => ({
        status: "COMPLETED",
        finalOutput: { results: { step_1: { note: "x" } }, expectedOutput: "done" },
        providerUsed: "groq/x",
        plan: null,
      }),
    } as unknown as ExecutionEngine;

    const service = new ExecutionService(execRepo, skillRepo, auditRepo, {
      approvalRepo,
      logRepo,
      engine,
    });

    await service.resumeExecution(execution.id, "u1");
    // Give the fire-and-forget continuation a tick to run its then() handler.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const final = await execRepo.findById(execution.id);
    expect(final?.status).toBe("COMPLETED");
    expect(final?.finalOutput).toEqual({ results: { step_1: { note: "x" } }, expectedOutput: "done" });

    // The resumed completion was audited.
    const audits = await auditRepo.listForUser("u1", { action: "EXECUTION_COMPLETED" });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it("resume route composition: resumeAfterApproval then resumeExecution succeeds (regression)", async () => {
    const execRepo = new FakeExecutionRepo();
    const skillRepo = new FakeSkillRepo();
    const auditRepo = new FakeAuditRepo();
    const approvalRepo = new FakeApprovalRepo();
    const historyRepo = new FakeHistoryRepo();
    const logRepo = new FakeLogRepo();

    const skill = await skillRepo.create({ userId: "u1", name: "S", purpose: "p", allowedTools: ["calculator"] });
    const version = (await skillRepo.findVersionsBySkillId(skill.id))[0];
    const execution = await execRepo.create(
      { userId: "u1", skillVersionId: version.id, inputData: {} },
      10,
      "S"
    );
    await execRepo.updateStatus(execution.id, "PAUSED_FOR_APPROVAL");
    await execRepo.setRuntimeDetails(execution.id, {
      provider: "groq/x",
      plannerOutput: {
        reasoning: "r",
        requiredTools: ["calculator"],
        steps: [{ stepNumber: 1, toolName: "calculator", action: "create", input: { note: "x" }, requiresApproval: true }],
        expectedOutput: "done",
      },
    });

    // An APPROVED approval request, as POST /api/approvals would have left it.
    const approval = await approvalRepo.upsertByIdempotencyKey({
      executionId: execution.id,
      userId: "u1",
      skillName: "S",
      plannerReason: "needs review",
      toolName: "calculator",
      action: "create",
      inputPayload: { note: "x" },
      idempotencyKey: `appr-${execution.id}-step-1`,
    });
    await approvalRepo.respond({
      approvalId: approval.id,
      userId: "u1",
      approved: true,
      idempotencyKey: approval.idempotencyKey,
    });

    const engineInputs: unknown[] = [];
    // The resume path now AWAITS the run (fire-and-forget froze on
    // serverless), so the stub RESOLVES a completed result.
    const engine = {
      run: async (input: unknown) => {
        engineInputs.push(input);
        return {
          status: "COMPLETED",
          finalOutput: { done: true },
          providerUsed: "groq/x",
          plan: null,
        };
      },
    } as unknown as ExecutionEngine;

    const service = new ExecutionService(execRepo, skillRepo, auditRepo, {
      approvalRepo,
      logRepo,
      engine,
    });
    // Mirrors POST /api/executions/[id]/resume: ApprovalEngine bookkeeping
    // first, then the service re-invokes the graph.
    const approvalEngine = new ApprovalEngine(approvalRepo, historyRepo, execRepo);
    await approvalEngine.resumeAfterApproval(approval.id, "u1");

    const result = await service.resumeExecution(execution.id, "u1");
    expect(result.id).toBe(execution.id);
    // The resumed run was launched exactly once, with restored resume state…
    expect(engineInputs).toHaveLength(1);
    expect((engineInputs[0] as { resume?: unknown }).resume).toBeDefined();
    // …and because the run is now awaited, the returned row already reflects
    // the terminal state (no polling a floating promise on serverless).
    expect(result.status).toBe("COMPLETED");
    const fresh = await execRepo.findById(execution.id);
    expect(fresh?.status).toBe("COMPLETED");
  });

  it("throws when there is no persisted plan to resume from", async () => {
    const execRepo = new FakeExecutionRepo();
    const skillRepo = new FakeSkillRepo();
    const auditRepo = new FakeAuditRepo();
    const approvalRepo = new FakeApprovalRepo();
    const logRepo = new FakeLogRepo();

    const skill = await skillRepo.create({ userId: "u1", name: "S", purpose: "p" });
    const version = (await skillRepo.findVersionsBySkillId(skill.id))[0];
    const execution = await execRepo.create(
      { userId: "u1", skillVersionId: version.id, inputData: {} },
      10,
      "S"
    );
    await execRepo.updateStatus(execution.id, "PAUSED_FOR_APPROVAL");

    const service = new ExecutionService(execRepo, skillRepo, auditRepo, {
      approvalRepo,
      logRepo,
      engine: {} as ExecutionEngine,
    });

    await expect(service.resumeExecution(execution.id, "u1")).rejects.toThrow(/No plan available to resume/);
  });
});
