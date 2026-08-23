import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApprovalEngine } from "@/modules/approval";
import { ApprovalRequestDTO, ApprovalHistoryDTO, ApprovalHistoryAction } from "@/types/approval";
import { StepLimitExceededError } from "@/modules/execution/executor/errors";

function makeApproval(overrides: Partial<ApprovalRequestDTO> = {}): ApprovalRequestDTO {
  return {
    id: "appr-1",
    executionId: "exec-1",
    userId: "u1",
    toolName: "mock_task_creator",
    action: "create",
    inputPayload: { title: "test" },
    status: "PENDING",
    idempotencyKey: "ik-1",
    requestedAt: new Date(),
    ...overrides,
  };
}

function makeHistory(overrides: Partial<ApprovalHistoryDTO> = {}): ApprovalHistoryDTO {
  return {
    id: "hist-1",
    approvalId: "appr-1",
    executionId: "exec-1",
    userId: "u1",
    action: "CREATED" as ApprovalHistoryAction,
    details: {},
    timestamp: new Date(),
    ...overrides,
  };
}

function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    userId: "u1",
    skillVersionId: "v1",
    status: "PAUSED_FOR_APPROVAL",
    inputData: {},
    stepCount: 3,
    maxSteps: 10,
    ...overrides,
  };
}

describe("ApprovalEngine", () => {
  let approvalRepo: {
    findById: ReturnType<typeof vi.fn>;
    respond: ReturnType<typeof vi.fn>;
    findByExecutionId: ReturnType<typeof vi.fn>;
  };
  let historyRepo: {
    log: ReturnType<typeof vi.fn>;
    findByApprovalId: ReturnType<typeof vi.fn>;
    findByExecutionId: ReturnType<typeof vi.fn>;
  };
  let executionRepo: {
    findById: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    findByUserId: ReturnType<typeof vi.fn>;
  };
  let engine: ApprovalEngine;

  beforeEach(() => {
    approvalRepo = {
      findById: vi.fn(),
      respond: vi.fn(),
      findByExecutionId: vi.fn(),
    };
    historyRepo = {
      log: vi.fn(),
      findByApprovalId: vi.fn().mockResolvedValue([]),
      findByExecutionId: vi.fn().mockResolvedValue([]),
    };
    executionRepo = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
      findByUserId: vi.fn().mockResolvedValue([]),
    };
    engine = new ApprovalEngine(
      approvalRepo as unknown as ConstructorParameters<typeof ApprovalEngine>[0],
      historyRepo as unknown as ConstructorParameters<typeof ApprovalEngine>[1],
      executionRepo as unknown as ConstructorParameters<typeof ApprovalEngine>[2]
    );
  });

  describe("approve", () => {
    it("approves a pending request and logs history", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval());
      approvalRepo.respond.mockResolvedValue(makeApproval({ status: "APPROVED" }));

      const result = await engine.approve("appr-1", "u1", "ik-1");

      expect(result.status).toBe("APPROVED");
      expect(approvalRepo.respond).toHaveBeenCalledWith({
        approvalId: "appr-1",
        userId: "u1",
        approved: true,
        idempotencyKey: "ik-1",
      });
      expect(historyRepo.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "APPROVED" })
      );
    });

    it("rejects wrong user (ownership)", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval({ userId: "u2" }));
      await expect(engine.approve("appr-1", "u1", "ik-1")).rejects.toThrow(
        "You do not have access"
      );
    });

    it("rejects wrong idempotency key", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval({ idempotencyKey: "ik-2" }));
      await expect(engine.approve("appr-1", "u1", "ik-1")).rejects.toThrow(
        "Invalid idempotency key"
      );
    });

    it("returns existing request if already APPROVED (safe re-play)", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval({ status: "APPROVED" }));
      const result = await engine.approve("appr-1", "u1", "ik-1");
      expect(result.status).toBe("APPROVED");
      expect(approvalRepo.respond).not.toHaveBeenCalled();
    });

    it("rejects non-PENDING, non-APPROVED status", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval({ status: "REJECTED" }));
      await expect(engine.approve("appr-1", "u1", "ik-1")).rejects.toThrow(
        "already in status REJECTED"
      );
    });

    it("handles lost CAS race", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval());
      approvalRepo.respond.mockResolvedValue(null); // Lost CAS race
      await expect(engine.approve("appr-1", "u1", "ik-1")).rejects.toThrow(
        "already responded to"
      );
    });
  });

  describe("reject", () => {
    it("rejects a pending request, logs history, and terminates execution", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval());
      approvalRepo.respond.mockResolvedValue(makeApproval({ status: "REJECTED" }));
      executionRepo.updateStatus.mockResolvedValue(makeExecution());

      const result = await engine.reject("appr-1", "u1", "Not needed", "ik-1");

      expect(result.status).toBe("REJECTED");
      expect(historyRepo.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "REJECTED" })
      );
      expect(executionRepo.updateStatus).toHaveBeenCalledWith(
        "exec-1",
        "FAILED",
        expect.stringContaining("Not needed")
      );
    });
  });

  describe("cancelPending", () => {
    it("cancels a pending request and terminates the workflow", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval());
      approvalRepo.respond.mockResolvedValue(makeApproval({ status: "REJECTED" }));
      executionRepo.updateStatus.mockResolvedValue(makeExecution());

      await engine.cancelPending("appr-1", "u1", "ik-1");

      expect(historyRepo.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CANCELLED" })
      );
      expect(executionRepo.updateStatus).toHaveBeenCalledWith(
        "exec-1",
        "CANCELLED",
        expect.stringContaining("cancelled")
      );
    });
  });

  describe("resumeAfterApproval", () => {
    it("resumes an approved request and logs history", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval({ status: "APPROVED" }));
      historyRepo.findByApprovalId.mockResolvedValue([makeHistory({ action: "APPROVED" })]);
      executionRepo.findById.mockResolvedValue(makeExecution({ stepCount: 4, maxSteps: 10 }));
      executionRepo.updateStatus.mockResolvedValue(makeExecution());

      const result = await engine.resumeAfterApproval("appr-1", "u1");

      expect(result.executionId).toBe("exec-1");
      expect(result.stepNumber).toBe(5);
      expect(historyRepo.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "RESUMED" })
      );
      // The RUNNING flip is owned by ExecutionService.resumeExecution (right
      // before the graph re-invocation) so its "already running" guard rejects
      // concurrent double-resumes. resumeAfterApproval only does bookkeeping.
      expect(executionRepo.updateStatus).not.toHaveBeenCalledWith("exec-1", "RUNNING");
    });

    it("prevents duplicate resume (already RESUMED)", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval({ status: "APPROVED" }));
      historyRepo.findByApprovalId.mockResolvedValue([
        makeHistory({ action: "APPROVED" }),
        makeHistory({ action: "RESUMED" }),
      ]);

      await expect(engine.resumeAfterApproval("appr-1", "u1")).rejects.toThrow(
        "duplicate execution prevented"
      );
    });

    it("rejects non-approved request", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval({ status: "PENDING" }));
      await expect(engine.resumeAfterApproval("appr-1", "u1")).rejects.toThrow(
        "Cannot resume"
      );
    });

    it("enforces step limit", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval({ status: "APPROVED" }));
      historyRepo.findByApprovalId.mockResolvedValue([makeHistory({ action: "APPROVED" })]);
      executionRepo.findById.mockResolvedValue(makeExecution({ stepCount: 10, maxSteps: 10 }));

      await expect(engine.resumeAfterApproval("appr-1", "u1")).rejects.toThrow(
        StepLimitExceededError
      );
      expect(executionRepo.updateStatus).toHaveBeenCalledWith(
        "exec-1",
        "STEP_LIMIT_EXCEEDED",
        expect.stringContaining("10")
      );
    });

    it("enforces ownership", async () => {
      approvalRepo.findById.mockResolvedValue(makeApproval({ userId: "u2" }));
      await expect(engine.resumeAfterApproval("appr-1", "u1")).rejects.toThrow(
        "You do not have access"
      );
    });
  });
});