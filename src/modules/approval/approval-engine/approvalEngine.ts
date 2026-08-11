import { IApprovalRepository } from "@/repositories/interfaces/IApprovalRepository";
import { IApprovalHistoryRepository } from "@/repositories/interfaces/IApprovalHistoryRepository";
import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { ApprovalRequestDTO } from "@/types/approval";
import { StepLimitExceededError } from "@/modules/execution/executor/errors";
import { logger } from "@/lib/logger";

export class ApprovalEngine {
  constructor(
    private approvalRepo: IApprovalRepository,
    private historyRepo: IApprovalHistoryRepository,
    private executionRepo: IExecutionRepository
  ) {}

  /**
   * Approve a pending review request. Returns the updated request.
   * Atomically: APPROVED → RESUME action on history → mark execution as RUNNING.
   * Throws if the request is already terminal (duplicate prevention).
   */
  async approve(
    approvalId: string,
    userId: string,
    idempotencyKey: string
  ): Promise<ApprovalRequestDTO> {
    const request = await this.approvalRepo.findById(approvalId);
    if (!request) throw new Error("Review request not found");
    if (request.userId !== userId) throw new Error("You do not have access to this review request");

    // Idempotency: the presented key must match the one the request was created with.
    if (request.idempotencyKey !== idempotencyKey) {
      throw new Error("Invalid idempotency key for this review request");
    }

    // Duplicate prevention: only PENDING requests can be approved.
    if (request.status !== "PENDING") {
      if (request.status === "APPROVED") {
        // Safe re-play: the caller already approved this — return the existing request.
        return request;
      }
      throw new Error(`Review request is already in status ${request.status}`);
    }

    // Atomic CAS: only a PENDING row can transition.
    const updated = await this.approvalRepo.respond({
      approvalId,
      userId,
      approved: true,
      idempotencyKey,
    });
    if (!updated) {
      // Lost the CAS race — someone else already responded.
      throw new Error("Review request was already responded to");
    }

    // Log the history entry.
    await this.historyRepo.log({
      approvalId,
      executionId: request.executionId,
      userId,
      action: "APPROVED",
      details: { toolName: request.toolName, action: request.action },
    });

    // NOTE: the execution is NOT flipped to RUNNING here on purpose. The
    // caller (POST /api/approvals → the review UI) must then call
    // POST /api/executions/[id]/resume, whose resumeAfterApproval performs
    // the duplicate/step-limit checks and logs the RESUMED history entry, and
    // whose resumeExecution flips the execution to RUNNING before re-invoking
    // the graph. (The RUNNING flip lives in resumeExecution so its
    // "already running" guard can reject concurrent double-resumes.)
    logger.info(
      { executionId: request.executionId, approvalId },
      "Approval granted — caller should resume the execution"
    );

    return updated;
  }

  /**
   * Reject a pending review request. Terminates the execution.
   * Returns the updated request.
   */
  async reject(
    approvalId: string,
    userId: string,
    reason: string,
    idempotencyKey: string
  ): Promise<ApprovalRequestDTO> {
    const request = await this.approvalRepo.findById(approvalId);
    if (!request) throw new Error("Review request not found");
    if (request.userId !== userId) throw new Error("You do not have access to this review request");

    // Idempotency check.
    if (request.idempotencyKey !== idempotencyKey) {
      throw new Error("Invalid idempotency key for this review request");
    }

    // Duplicate prevention.
    if (request.status !== "PENDING") {
      if (request.status === "REJECTED") {
        return request; // Safe re-play.
      }
      throw new Error(`Review request is already in status ${request.status}`);
    }

    const updated = await this.approvalRepo.respond({
      approvalId,
      userId,
      approved: false,
      rejectionReason: reason,
      idempotencyKey,
    });
    if (!updated) {
      throw new Error("Review request was already responded to");
    }

    // Log the history entry.
    await this.historyRepo.log({
      approvalId,
      executionId: request.executionId,
      userId,
      action: "REJECTED",
      details: { toolName: request.toolName, action: request.action, reason },
    });

    // Terminate the execution — a rejected action means the workflow is denied.
    await this.executionRepo.updateStatus(
      request.executionId,
      "FAILED",
      `Action rejected by user: ${request.toolName} · ${request.action}${reason ? ` (${reason})` : ""}`
    );

    logger.info(
      { executionId: request.executionId, approvalId, reason },
      "Approval rejected — execution terminated"
    );

    return updated;
  }

  /**
   * Cancel a pending review request. Terminates the execution.
   * This is for when the user wants to cancel the workflow entirely, not just reject one action.
   */
  async cancelPending(
    approvalId: string,
    userId: string,
    idempotencyKey: string
  ): Promise<ApprovalRequestDTO> {
    const request = await this.approvalRepo.findById(approvalId);
    if (!request) throw new Error("Review request not found");
    if (request.userId !== userId) throw new Error("You do not have access to this review request");

    if (request.idempotencyKey !== idempotencyKey) {
      throw new Error("Invalid idempotency key for this review request");
    }

    if (request.status !== "PENDING") {
      if (request.status === "REJECTED" || request.status === "APPROVED") {
        return request; // Safe re-play.
      }
      throw new Error(`Review request is already in status ${request.status}`);
    }

    // Expire the request (not rejected — cancelled, which is a distinct action).
    // We model this as REJECTED in the DB but with a specific reason.
    const updated = await this.approvalRepo.respond({
      approvalId,
      userId,
      approved: false,
      rejectionReason: "Workflow cancelled by user",
      idempotencyKey,
    });
    if (!updated) {
      throw new Error("Review request was already responded to");
    }

    await this.historyRepo.log({
      approvalId,
      executionId: request.executionId,
      userId,
      action: "CANCELLED",
      details: { toolName: request.toolName, action: request.action },
    });

    // Cancel the entire workflow.
    await this.executionRepo.updateStatus(
      request.executionId,
      "CANCELLED",
      "Workflow cancelled by user during review"
    );

    logger.info(
      { executionId: request.executionId, approvalId },
      "Workflow cancelled during review"
    );

    return updated;
  }

  /**
   * Resume a paused execution after its approval request was approved.
   * Records the RESUMED history entry (duplicate prevention) and enforces the
   * step limit, then returns the execution ID for the caller to re-run. The
   * execution itself is flipped to RUNNING by ExecutionService.resumeExecution
   * right before the graph is re-invoked — this method only does bookkeeping so
   * the service's "already running" guard can reject concurrent double-resumes.
   *
   * Throws StepLimitExceededError if the execution has already hit its max steps.
   */
  async resumeAfterApproval(
    approvalId: string,
    userId: string
  ): Promise<{ executionId: string; stepNumber: number }> {
    const request = await this.approvalRepo.findById(approvalId);
    if (!request) throw new Error("Review request not found");
    if (request.userId !== userId) throw new Error("You do not have access to this review request");

    // Only approved requests can resume.
    if (request.status !== "APPROVED") {
      throw new Error(`Cannot resume: request is ${request.status}`);
    }

    // Duplicate execution protection: check if this was already resumed.
    const history = await this.historyRepo.findByApprovalId(approvalId);
    const alreadyResumed = history.some((h) => h.action === "RESUMED");
    if (alreadyResumed) {
      throw new Error("This approved request has already been resumed — duplicate execution prevented");
    }

    // Load the execution to check step limit.
    const execution = await this.executionRepo.findById(request.executionId);
    if (!execution) throw new Error("Execution not found");

    // Step limit enforcement.
    if (execution.stepCount >= execution.maxSteps) {
      await this.executionRepo.updateStatus(
        request.executionId,
        "STEP_LIMIT_EXCEEDED",
        `Step limit (${execution.maxSteps}) reached after approval`
      );
      throw new StepLimitExceededError(
        `Execution has reached its step limit of ${execution.maxSteps}`
      );
    }

    // Log the resume history entry.
    await this.historyRepo.log({
      approvalId,
      executionId: request.executionId,
      userId,
      action: "RESUMED",
      details: {
        toolName: request.toolName,
        action: request.action,
        step: execution.stepCount + 1,
      },
    });

    logger.info(
      { executionId: request.executionId, approvalId, step: execution.stepCount + 1 },
      "Execution resumed after approval"
    );

    return { executionId: request.executionId, stepNumber: execution.stepCount + 1 };
  }
}