/**
 * Plan Limits Service
 *
 * Enforces resource limits based on organization plan tier.
 * Limits: members, skills, executions, mcp servers, vault entries, etc.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ForbiddenError } from "./RBACService";

// ────────────── Types ──────────────

export type PlanTier = "free" | "pro" | "enterprise";

export interface PlanLimits {
  maxMembers: number;        // -1 = unlimited
  maxSkills: number;         // -1 = unlimited
  maxExecutionsPerMonth: number;  // -1 = unlimited
  maxMcpServers: number;     // -1 = unlimited
  maxVaultEntries: number;   // -1 = unlimited
  maxCustomRoles: number;    // -1 = unlimited
  maxApiKeys: number;        // -1 = unlimited
  hasCustomRoles: boolean;
  hasSso: boolean;
  hasAuditExport: boolean;
}

export interface UsageStats {
  members: number;
  skills: number;
  executionsThisMonth: number;
  mcpServers: number;
  vaultEntries: number;
  customRoles: number;
  apiKeys: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  resource: string;
  current: number;
  limit: number;
  plan: PlanTier;
  message?: string;
}

// ────────────── Plan Definitions ──────────────

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxMembers: 5,
    maxSkills: 10,
    maxExecutionsPerMonth: 100,
    maxMcpServers: 3,
    maxVaultEntries: 20,
    maxCustomRoles: 0,
    maxApiKeys: 2,
    hasCustomRoles: false,
    hasSso: false,
    hasAuditExport: false,
  },
  pro: {
    maxMembers: 25,
    maxSkills: -1,           // unlimited
    maxExecutionsPerMonth: 10000,
    maxMcpServers: 25,
    maxVaultEntries: 500,
    maxCustomRoles: 10,
    maxApiKeys: 10,
    hasCustomRoles: true,
    hasSso: false,
    hasAuditExport: true,
  },
  enterprise: {
    maxMembers: -1,          // unlimited
    maxSkills: -1,
    maxExecutionsPerMonth: -1,
    maxMcpServers: -1,
    maxVaultEntries: -1,
    maxCustomRoles: -1,
    maxApiKeys: -1,
    hasCustomRoles: true,
    hasSso: true,
    hasAuditExport: true,
  },
};

// ────────────── Service ──────────────

export class PlanLimitsService {
  /**
   * Get limits for a plan tier
   */
  getPlanLimits(plan: string): PlanLimits {
    const tier = (plan as PlanTier) || "free";
    return PLAN_LIMITS[tier] || PLAN_LIMITS.free;
  }

  /**
   * Get current usage stats for an organization
   */
  async getUsageStats(organizationId: string): Promise<UsageStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [members, skills, executionsThisMonth, mcpServers, vaultEntries, customRoles, apiKeys] =
      await Promise.all([
        prisma.organizationMember.count({ where: { organizationId } }),
        prisma.skill.count({ where: { organizationId } }),
        prisma.execution.count({
          where: {
            organizationId,
            startedAt: { gte: startOfMonth },
          },
        }),
        prisma.mcpServer.count({ where: { organizationId } }),
        prisma.vaultEntry.count({ where: { organizationId } }),
        prisma.customRole.count({ where: { organizationId } }),
        prisma.apiKey.count({ where: { organizationId } }),
      ]);

    return {
      members,
      skills,
      executionsThisMonth,
      mcpServers,
      vaultEntries,
      customRoles,
      apiKeys,
    };
  }

  /**
   * Check if adding a resource would exceed plan limits
   */
  async checkLimit(
    organizationId: string,
    resource: keyof UsageStats,
    increment: number = 1
  ): Promise<LimitCheckResult> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    if (!org) {
      return {
        allowed: false,
        resource,
        current: 0,
        limit: 0,
        plan: "free",
        message: "Organization not found",
      };
    }

    const limits = this.getPlanLimits(org.plan);
    const stats = await this.getUsageStats(organizationId);

    const limit = this.getLimitForResource(limits, resource);
    const current = stats[resource];

    // Unlimited
    if (limit === -1) {
      return {
        allowed: true,
        resource,
        current,
        limit,
        plan: org.plan as PlanTier,
      };
    }

    const allowed = current + increment <= limit;

    return {
      allowed,
      resource,
      current,
      limit,
      plan: org.plan as PlanTier,
      message: allowed
        ? undefined
        : `${resource} limit reached for ${org.plan} plan (${current}/${limit}). Upgrade to add more.`,
    };
  }

  /**
   * Enforce limit or throw ForbiddenError
   */
  async enforceLimit(
    organizationId: string,
    resource: keyof UsageStats,
    increment: number = 1
  ): Promise<void> {
    const result = await this.checkLimit(organizationId, resource, increment);

    if (!result.allowed) {
      logger.warn(
        { organizationId, resource, current: result.current, limit: result.limit },
        "Plan limit exceeded"
      );
      throw new ForbiddenError(result.message || `Plan limit exceeded for ${resource}`);
    }
  }

  /**
   * Check if a feature is available for the plan
   */
  async hasFeature(organizationId: string, feature: keyof PlanLimits): Promise<boolean> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    if (!org) return false;

    const limits = this.getPlanLimits(org.plan);
    return !!limits[feature];
  }

  /**
   * Upgrade organization plan
   */
  async upgradePlan(
    organizationId: string,
    newPlan: PlanTier,
    userId: string
  ): Promise<void> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    if (!org) {
      throw new Error("Organization not found");
    }

    const oldPlan = org.plan as PlanTier;

    // Validate upgrade (can only upgrade, not downgrade via this method)
    const planOrder: Record<PlanTier, number> = { free: 0, pro: 1, enterprise: 2 };
    if (planOrder[newPlan] <= planOrder[oldPlan]) {
      throw new ForbiddenError("Can only upgrade to a higher plan tier");
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: { plan: newPlan },
    });

    logger.info({ organizationId, oldPlan, newPlan, userId }, "Organization plan upgraded");
  }

  /**
   * Get usage summary for display
   */
  async getUsageSummary(organizationId: string): Promise<{
    plan: PlanTier;
    limits: PlanLimits;
    usage: UsageStats;
    percentages: Record<keyof UsageStats, number>;
  }> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    const plan = ((org?.plan as PlanTier) || "free");
    const limits = this.getPlanLimits(plan);
    const usage = await this.getUsageStats(organizationId);

    const percentages: Record<string, number> = {};
    for (const key of Object.keys(usage) as (keyof UsageStats)[]) {
      const limit = this.getLimitForResource(limits, key);
      percentages[key] = limit === -1 ? 0 : Math.round((usage[key] / limit) * 100);
    }

    return {
      plan,
      limits,
      usage,
      percentages: percentages as Record<keyof UsageStats, number>,
    };
  }

  // ────────────── Helpers ──────────────

  private getLimitForResource(limits: PlanLimits, resource: keyof UsageStats): number {
    switch (resource) {
      case "members": return limits.maxMembers;
      case "skills": return limits.maxSkills;
      case "executionsThisMonth": return limits.maxExecutionsPerMonth;
      case "mcpServers": return limits.maxMcpServers;
      case "vaultEntries": return limits.maxVaultEntries;
      case "customRoles": return limits.maxCustomRoles;
      case "apiKeys": return limits.maxApiKeys;
      default: return -1;
    }
  }
}
