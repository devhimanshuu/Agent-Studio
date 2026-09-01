import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";
import { ApprovalHistoryRepository } from "@/repositories/ApprovalHistoryRepository";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { OpenApiRepository } from "@/repositories/OpenApiRepository";
import { ExecutionLogRepository } from "@/repositories/ExecutionLogRepository";
import { ApprovalEngine, ApprovalHistoryService } from "@/modules/approval";
import { ExecutionHistoryService } from "@/modules/history";
import { McpClientService } from "@/services/McpClientService";
import { OpenApiService } from "@/services/OpenApiService";
import { ExecutionService } from "@/services/ExecutionService";
import { RBACService } from "@/services/RBACService";
import { SkillService } from "@/services/SkillService";
import { AuditService } from "@/services/AuditService";
import { PlanLimitsService } from "@/services/PlanLimitsService";
import { CustomRoleService } from "@/services/CustomRoleService";
import { ApiKeyService } from "@/services/ApiKeyService";
import { OrganizationService } from "@/services/OrganizationService";
import { VaultService } from "@/services/VaultService";
import { DashboardStatsService } from "@/services/DashboardStatsService";
import { InvitationEmailService } from "@/services/InvitationEmailService"

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
  // Repositories
  executionRepo: ExecutionRepository;
  skillRepo: SkillRepository;
  auditRepo: AuditLogRepository;
  approvalRepo: ApprovalRepository;
  historyRepo: ApprovalHistoryRepository;
  logRepo: ExecutionLogRepository;
  // Services with state (must be singletons)
  mcpService: McpClientService;
  openApiService: OpenApiService;
  executionService: ExecutionService;
  historyService: ExecutionHistoryService;
  approvalEngine: ApprovalEngine;
  approvalHistoryService: ApprovalHistoryService;
  // Stateless services (singletons avoid redundant instantiation)
  rbacService: RBACService;
  skillService: SkillService;
  auditService: AuditService;
  planLimitsService: PlanLimitsService;
  customRoleService: CustomRoleService;
  apiKeyService: ApiKeyService;
  organizationService: OrganizationService;
  vaultService: VaultService;
  dashboardStatsService: DashboardStatsService;
  invitationEmailService: InvitationEmailService;
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
  const approvalHistoryService = new ApprovalHistoryService(historyRepo);
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
  const rbacService = new RBACService();
  const skillService = new SkillService(skillRepo, auditRepo);
  const auditService = new AuditService();
  const planLimitsService = new PlanLimitsService();
  const customRoleService = new CustomRoleService();
  const apiKeyService = new ApiKeyService();
  const organizationService = new OrganizationService();
  const vaultService = new VaultService();
  const dashboardStatsService = new DashboardStatsService();
  const invitationEmailService = new InvitationEmailService();

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
    approvalHistoryService,
    executionService,
    historyService,
    rbacService,
    skillService,
    auditService,
    planLimitsService,
    customRoleService,
    apiKeyService,
    organizationService,
    vaultService,
    dashboardStatsService,
    invitationEmailService,
  };
}

const g = globalThis as typeof globalThis & Record<string, unknown>;

export function apiServices(): ApiServices {
  if (!g[globalKey]) {
    g[globalKey] = build();
  }
  return g[globalKey] as ApiServices;
}
