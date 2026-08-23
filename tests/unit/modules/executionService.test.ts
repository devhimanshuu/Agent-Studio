import { describe, it, expect } from "vitest";
import { ExecutionService } from "@/services/ExecutionService";
import { ExecutionEngine } from "@/modules/execution/executor/executionEngine";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { FakeExecutionRepo } from "./helpers/fakeExecutionRepo";

const noopSkillRepo = {} as unknown as ISkillRepository;
const noopAuditRepo = {
  log: async () => ({ id: "log", details: {}, action: "", timestamp: new Date() }),
} as unknown as IAuditLogRepository;
const noopEngine = {} as unknown as ExecutionEngine;

function makeService() {
  const repo = new FakeExecutionRepo();
  const service = new ExecutionService(repo, noopSkillRepo, noopAuditRepo, { engine: noopEngine });
  return { service, repo };
}

describe("ExecutionService.cancelExecution", () => {
  it("does not relabel a completed execution", async () => {
    const { service, repo } = makeService();
    const execution = await repo.create(
      { userId: "u1", skillVersionId: "v1", inputData: {} },
      10
    );
    await repo.updateStatus(execution.id, "COMPLETED");

    const result = await service.cancelExecution(execution.id, "u1");

    expect(result.status).toBe("COMPLETED");
    expect(repo.statusUpdates).toHaveLength(1); // only the COMPLETED update, no CANCELLED flip
  });

  it("cancels an active (running) execution", async () => {
    const { service, repo } = makeService();
    const execution = await repo.create(
      { userId: "u1", skillVersionId: "v1", inputData: {} },
      10
    );

    const result = await service.cancelExecution(execution.id, "u1");

    expect(result.status).toBe("CANCELLED");
    expect(repo.statusUpdates).toHaveLength(1);
    expect(repo.statusUpdates[0].status).toBe("CANCELLED");
  });

  it("throws for a missing execution", async () => {
    const { service } = makeService();
    await expect(service.cancelExecution("nope", "u1")).rejects.toThrow("Execution not found");
  });

  it("scopes cancellation to the owning user", async () => {
    const { service, repo } = makeService();
    const execution = await repo.create(
      { userId: "u1", skillVersionId: "v1", inputData: {} },
      10
    );

    await expect(service.cancelExecutionForUser(execution.id, "other-user")).rejects.toThrow(
      /not found or you do not have access/
    );
  });
});
