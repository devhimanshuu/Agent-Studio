import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { ApprovalHistoryRepository } from "@/repositories/ApprovalHistoryRepository";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { OpenApiRepository } from "@/repositories/OpenApiRepository";
import { ExecutionLogRepository } from "@/repositories/ExecutionLogRepository";
import { ApprovalEngine } from "@/modules/approval";
import { ExecutionHistoryService } from "@/modules/history";
import { McpClientService } from "@/services/McpClientService";
import { OpenApiService } from "@/services/OpenApiService";
import { ExecutionService } from "@/services/ExecutionService";

/**
 * Process-wide singleton API service graph.
 *
 * Every route MUST share these instances. The services hold in-process state
 * that is meaningless when fragmented per route module:
 *  - McpClientService: live transport connections, circuit breakers, tool
 *    snapshots (a per-route instance makes the SSE progress stream silently
 *    dead and disconnects unable to reach the connection another route opened).
 *  - ExecutionService: CancellationManager + tool registries (a per-route
 *    instance made POST /executions/[id]/cancel a no-op for runs started via
 *    POST /executions, because each instance kept its own AbortControllers).
 *
 * Next.js may load route modules in separate contexts; module-level
 * instantiation via `globalThis` keeps one graph per process.
 */

interface ApiServices {
  executionRepo: ExecutionRepository;
  skillRepo: SkillRepository;
  auditRepo: AuditLogRepository;
  approvalRepo: ApprovalRepository;
  historyRepo: ApprovalHistoryRepository;
  logRepo: ExecutionLogRepository;
  mcpService: McpClientService;
  openApiService: OpenApiService;
  approvalEngine: ApprovalEngine;
  executionService: ExecutionService;
  historyService: ExecutionHistoryService;
}

const globalKey = "__agentStudioApiServices";

function build(): ApiServices {
  const executionRepo = new ExecutionRepository();
  const skillRepo = new SkillRepository();
  const auditRepo = new AuditLogRepository();
  const approvalRepo = new ApprovalRepository();
  const historyRepo = new ApprovalHistoryRepository();
  const logRepo = new ExecutionLogRepository();
  const mcpService = new McpClientService(new McpServerRepository());
  const openApiService = new OpenApiService(new OpenApiRepository());
  const approvalEngine = new ApprovalEngine(approvalRepo, historyRepo, executionRepo);
  const executionService = new ExecutionService(executionRepo, skillRepo, auditRepo, {
    mcpService,
    openApiService,
    approvalRepo,
    logRepo,
  });
  const historyService = new ExecutionHistoryService(
    executionRepo,
    skillRepo,
    auditRepo,
    executionService,
    logRepo,
    approvalRepo,
    historyRepo
  );
  return {
    executionRepo,
    skillRepo,
    auditRepo,
    approvalRepo,
    historyRepo,
    logRepo,
    mcpService,
    openApiService,
    approvalEngine,
    executionService,
    historyService,
  };
}

const g = globalThis as typeof globalThis & Record<string, unknown>;

export function apiServices(): ApiServices {
  if (!g[globalKey]) {
    g[globalKey] = build();
  }
  return g[globalKey] as ApiServices;
}
