import { describe, it, expect } from "vitest";
import { FakeExecutionRepo } from "./helpers/fakeExecutionRepo";
import { FakeSkillRepo } from "./helpers/fakeSkillRepo";
import { FakeAuditRepo } from "./helpers/fakeAuditRepo";
import { FakeApprovalRepo } from "./helpers/fakeApprovalRepo";
import { FakeLogRepo } from "./helpers/fakeLogRepo";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionHistoryService } from "@/modules/history";
import { MetricsService } from "@/modules/observability";
import { VersionComparisonService } from "@/modules/comparison";
import { AuditService } from "@/modules/audit";
import { buildExecutionTimeline } from "@/modules/timeline";
import { ExecutionDTO, ExecutionStepDTO, ToolCallDTO } from "@/types/execution";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { ApprovalRequestDTO } from "@/types/approval";

function makeExecution(overrides: Partial<ExecutionDTO> = {}): ExecutionDTO {
  return {
    id: "exec-1",
    userId: "u1",
    skillVersionId: "v1",
    skillName: "Incident Triage",
    status: "COMPLETED",
    inputData: { issue: "down" },
    finalOutput: { ok: true },
    stepCount: 2,
    maxSteps: 10,
    durationMs: 1250,
    provider: "groq/llama-3.3-70b-versatile",
    startedAt: new Date("2026-08-01T10:00:00Z"),
    completedAt: new Date("2026-08-01T10:00:01Z"),
    ...overrides,
  };
}

function makeSkill(): SkillDTO {
  return {
    id: "s1",
    userId: "u1",
    name: "Incident Triage",
    purpose: "Triage incidents",
    status: "PUBLISHED",
    currentDraftId: null,
    publishedVersionId: "v2",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeVersion(overrides: Partial<SkillVersionDTO> = {}): SkillVersionDTO {
  return {
    id: "v1",
    skillId: "s1",
    versionNumber: 1,
    status: "PUBLISHED",
    inputSchema: { type: "object" },
    outputSchema: { type: "string" },
    instructions: "Triage the incident.",
    examples: [],
    allowedTools: ["calculator"],
    actionsRequiringApproval: [],
    maxExecutionSteps: 10,
    createdAt: new Date(),
    publishedAt: new Date(),
    ...overrides,
  };
}

function makeStep(overrides: Partial<ExecutionStepDTO> = {}): ExecutionStepDTO {
  return {
    id: "step-1",
    executionId: "exec-1",
    stepNumber: 1,
    nodeName: "planner",
    stateSnapshot: { plan: { steps: 1 } },
    status: "SUCCESS",
    startedAt: new Date("2026-08-01T10:00:00.5Z"),
    completedAt: new Date("2026-08-01T10:00:00.6Z"),
    ...overrides,
  };
}

function makeToolCall(overrides: Partial<ToolCallDTO> = {}): ToolCallDTO {
  return {
    id: "tc-1",
    executionId: "exec-1",
    toolName: "calculator",
    action: "add",
    inputArgs: { a: 1, b: 2 },
    outputResult: { result: 3 },
    status: "SUCCESS",
    durationMs: 45,
    executedAt: new Date("2026-08-01T10:00:00.7Z"),
    ...overrides,
  };
}

function makeApproval(overrides: Partial<ApprovalRequestDTO> = {}): ApprovalRequestDTO {
  return {
    id: "appr-1",
    executionId: "exec-1",
    userId: "u1",
    skillName: "Incident Triage",
    plannerReason: "Creating a task is a write action.",
    toolName: "mock_task_creator",
    action: "create",
    inputPayload: { title: "Refind #491" },
    status: "APPROVED",
    idempotencyKey: "appr-exec-1-step-1",
    requestedAt: new Date("2026-08-01T10:00:00.8Z"),
    respondedAt: new Date("2026-08-01T10:00:00.9Z"),
    ...overrides,
  };
}

describe("ExecutionHistoryService.list (search/filter/sort)", () => {
  it("filters by status and free-text search", async () => {
    const repo = new FakeExecutionRepo();
    await repo.create({ userId: "u1", skillVersionId: "v1", inputData: {} }, 10, "Incident Triage");
    const failed = await repo.create({ userId: "u1", skillVersionId: "v2", inputData: {} }, 10, "On-call Bot");
    await repo.updateStatus(failed.id, "FAILED", "Provider timeout");
    const paused = await repo.create({ userId: "u1", skillVersionId: "v3", inputData: {} }, 10, "Risk Analyzer");
    await repo.updateStatus(paused.id, "PAUSED_FOR_APPROVAL");

    const service = new ExecutionHistoryService(repo, {} as never, {} as never, {} as never);

    const failedOnly = await service.list("u1", { status: "FAILED" });
    expect(failedOnly).toHaveLength(1);
    expect(failedOnly[0].status).toBe("FAILED");

    const bySearch = await service.list("u1", { search: "incident" });
    expect(bySearch).toHaveLength(1);
    expect(bySearch[0].skillName).toBe("Incident Triage");

    const all = await service.list("u1", {});
    expect(all).toHaveLength(3);
  });

  it("does not leak another user's executions", async () => {
    const repo = new FakeExecutionRepo();
    await repo.create({ userId: "u1", skillVersionId: "v1", inputData: {} }, 10);
    await repo.create({ userId: "u2", skillVersionId: "v1", inputData: {} }, 10);

    const service = new ExecutionHistoryService(repo, {} as never, {} as never, {} as never);
    const forUser1 = await service.list("u1", {});
    expect(forUser1).toHaveLength(1);
    expect(forUser1[0].userId).toBe("u1");
  });
});

describe("VersionComparisonService.compare", () => {
  function makeComparisonEnv() {
    const repo = new FakeSkillRepo();
    const skill = makeSkill();
    repo.addSkill(skill);
    const v1 = makeVersion({ id: "v1", versionNumber: 1, instructions: "Old instructions", allowedTools: ["calculator"] });
    const v2 = makeVersion({
      id: "v2",
      versionNumber: 2,
      instructions: "New instructions",
      allowedTools: ["calculator", "document_search"],
      maxExecutionSteps: 20,
    });
    repo.addVersion(v1);
    repo.addVersion(v2);
    return { repo, v1, v2 };
  }

  it("reports modified, added, and unchanged fields", async () => {
    const { repo, v1: _v1, v2: _v2 } = makeComparisonEnv();
    const service = new VersionComparisonService(repo);

    const diff = await service.compare("v1", "v2", "u1");

    expect(diff.skillName).toBe("Incident Triage");
    expect(diff.identical).toBe(false);

    const instructions = diff.changes.find((c) => c.field === "Instructions");
    expect(instructions?.kind).toBe("modified");
    expect(instructions?.oldValue).toBe("Old instructions");
    expect(instructions?.newValue).toBe("New instructions");

    const tools = diff.changes.find((c) => c.field === "Allowed Tools");
    expect(tools?.kind).toBe("modified");
    expect(JSON.stringify(tools?.oldValue)).toContain("calculator");
    expect(JSON.stringify(tools?.newValue)).toContain("document_search");

    const maxSteps = diff.changes.find((c) => c.field === "Max Steps");
    expect(maxSteps?.kind).toBe("modified");
  });

  it("returns identical for two versions with no changes", async () => {
    const { repo, v1 } = makeComparisonEnv();
    const service = new VersionComparisonService(repo);
    const v1b = makeVersion({ id: "v1b", versionNumber: 1, instructions: "Old instructions", allowedTools: ["calculator"] });
    repo.addVersion(v1b);

    const diff = await service.compare(v1.id, v1b.id, "u1");
    expect(diff.identical).toBe(true);
    expect(diff.changes).toHaveLength(0);
  });

  it("rejects versions from different skills", async () => {
    const { repo, v1 } = makeComparisonEnv();
    const other = makeVersion({ id: "v9", skillId: "other-skill", versionNumber: 1 });
    repo.addVersion(other);

    const service = new VersionComparisonService(repo);
    await expect(service.compare(v1.id, other.id, "u1")).rejects.toThrow("same skill");
  });

  it("scopes comparison to the owning user", async () => {
    const { repo, v1, v2 } = makeComparisonEnv();
    const service = new VersionComparisonService(repo);

    await expect(service.compare(v1.id, v2.id, "intruder")).rejects.toThrow(/not have access/);
  });
});

describe("AuditService", () => {
  it("lists only the owning user's entries with action filtering", async () => {
    const repo = new FakeAuditRepo();
    await repo.log({ userId: "u1", action: "SKILL_CREATED", details: { name: "A" } });
    await repo.log({ userId: "u1", action: "SKILL_PUBLISHED", details: { name: "A" } });
    await repo.log({ userId: "u2", action: "SKILL_CREATED", details: { name: "B" } });

    const service = new AuditService(repo);
    const published = await service.list("u1", { action: "SKILL_PUBLISHED" });
    expect(published).toHaveLength(1);
    expect(published[0].action).toBe("SKILL_PUBLISHED");

    const all = await service.list("u1", {});
    expect(all).toHaveLength(2);
  });

  it("exports with metadata and a bounded entry count", async () => {
    const repo = new FakeAuditRepo();
    for (let i = 0; i < 5; i++) {
      await repo.log({ userId: "u1", action: "EXECUTION_STARTED", details: { i } });
    }

    const service = new AuditService(repo);
    const payload = await service.export("u1", {});
    expect(payload.count).toBe(5);
    expect(payload.entries).toHaveLength(5);
    expect(payload.exportedAt).toBeTypeOf("string");
  });
});

describe("ExecutionHistoryService.replay", () => {
  it("creates a NEW execution linked to the original, never mutating history", async () => {
    const execRepo = new FakeExecutionRepo();
    const skillRepo = new FakeSkillRepo();
    const auditRepo = new FakeAuditRepo();
    const approvalRepo = new FakeApprovalRepo();
    const logRepo = new FakeLogRepo();

    const skill = skillRepo.create({ userId: "u1", name: "Incident Triage", purpose: "x", allowedTools: ["calculator"] });
    const version = (await skillRepo.findVersionsBySkillId((await skill).id))[0];

    // Create an original (completed) execution.
    const original = await execRepo.create(
      { userId: "u1", skillVersionId: version.id, inputData: { issue: "p1" } },
      10,
      "Incident Triage"
    );
    await execRepo.updateStatus(original.id, "COMPLETED");

    const executionService = new ExecutionService(execRepo, skillRepo, auditRepo, {
      approvalRepo,
      logRepo,
      // No-op engine: we only assert replay linkage, not actual execution.
      engine: {
        run: async () => ({ status: "COMPLETED", finalOutput: { ok: true }, providerUsed: "stub", plan: null }),
      } as never,
    });

    const history = new ExecutionHistoryService(execRepo, skillRepo, auditRepo, executionService, logRepo, approvalRepo);

    const replayed = await history.replay(original.id, "u1");

    // A new execution was created, linked to the original.
    expect(replayed.id).not.toBe(original.id);
    expect(replayed.replayedFromExecutionId).toBe(original.id);
    expect(replayed.inputData).toEqual({ issue: "p1" });

    // The original was never touched.
    const untouched = await execRepo.findByIdForUser(original.id, "u1");
    expect(untouched?.replayedFromExecutionId).toBeUndefined();
    expect(untouched?.status).toBe("COMPLETED");

    // Replay was audited.
    const audits = await auditRepo.listForUser("u1", { action: "EXECUTION_REPLAYED" });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it("scopes replay to the owning user", async () => {
    const execRepo = new FakeExecutionRepo();
    const original = await execRepo.create({ userId: "u1", skillVersionId: "v1", inputData: {} }, 10, "Skill");

    const history = new ExecutionHistoryService(
      execRepo,
      {} as never,
      {} as never,
      {} as never
    );

    await expect(history.replay(original.id, "other-user")).rejects.toThrow(/not found or you do not have access/);
  });
});

describe("MetricsService", () => {
  it("computes success rate, averages, and most-used skills/tools", async () => {
    const repo = new FakeExecutionRepo();
    const a = await repo.create({ userId: "u1", skillVersionId: "v1", inputData: {} }, 10, "Skill A");
    await repo.updateStatus(a.id, "COMPLETED");
    repo.setRuntimeDetails(a.id, { durationMs: 1000 });
    repo.addToolCall(a.id, { toolName: "calculator", action: "add", inputArgs: {}, outputResult: {}, status: "SUCCESS", durationMs: 10 });

    const b = await repo.create({ userId: "u1", skillVersionId: "v1", inputData: {} }, 10, "Skill A");
    await repo.updateStatus(b.id, "FAILED", "timeout");
    repo.setRuntimeDetails(b.id, { durationMs: 3000 });

    const service = new MetricsService(repo);
    const metrics = await service.getMetrics("u1");

    expect(metrics.totalExecutions).toBe(2);
    expect(metrics.successRate).toBe(50);
    expect(metrics.failureRate).toBe(50);
    expect(metrics.avgExecutionTimeMs).toBe(2000);
    expect(metrics.mostUsedSkills[0]).toEqual({ skillName: "Skill A", count: 2 });
    expect(metrics.mostUsedTools[0]).toEqual({ toolName: "calculator", count: 1 });
    expect(metrics.executionsByStatus.COMPLETED).toBe(1);
    expect(metrics.executionsByStatus.FAILED).toBe(1);
  });

  it("defaults to 100% success rate with no completed-or-failed runs", async () => {
    const repo = new FakeExecutionRepo();
    const service = new MetricsService(repo);
    const metrics = await service.getMetrics("u1");
    expect(metrics.totalExecutions).toBe(0);
    expect(metrics.successRate).toBe(100);
    expect(metrics.avgExecutionTimeMs).toBe(0);
  });
});

describe("buildExecutionTimeline", () => {
  it("merges lifecycle, node, tool, and approval events in time order", () => {
    const execution = makeExecution({
      steps: [makeStep()],
      toolCalls: [makeToolCall()],
    });
    const approvals = [makeApproval()];

    const timeline = buildExecutionTimeline(execution, approvals);

    // Execution start, node step, tool call, approval request + response.
    expect(timeline.length).toBeGreaterThanOrEqual(5);
    expect(timeline[0].label).toBe("Execution Started");
    expect(timeline.some((e) => e.label === "Planner Generated")).toBe(true);
    expect(timeline.some((e) => e.label.includes("Tool Executed"))).toBe(true);
    expect(timeline.some((e) => e.label.includes("Approval Requested"))).toBe(true);
    expect(timeline.some((e) => e.label === "Approval Approved")).toBe(true);

    // Sorted ascending by time.
    for (let i = 1; i < timeline.length; i++) {
      expect(new Date(timeline[i].at).getTime()).toBeGreaterThanOrEqual(new Date(timeline[i - 1].at).getTime());
    }
  });

  it("handles string ISO dates when sorting execution timeline without throwing e.at.getTime error", () => {
    const serializedExecution = JSON.parse(JSON.stringify(makeExecution()));
    const timeline = buildExecutionTimeline(serializedExecution);
    expect(timeline.length).toBeGreaterThan(0);
    expect(typeof timeline[0].at).toBe("string");
  });
});

