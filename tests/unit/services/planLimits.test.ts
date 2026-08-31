import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlanLimitsService } from "@/services/PlanLimitsService";

const mockPrisma = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  organizationMember: { count: vi.fn() },
  skill: { count: vi.fn() },
  execution: { count: vi.fn() },
  mcpServer: { count: vi.fn() },
  vaultEntry: { count: vi.fn() },
  customRole: { count: vi.fn() },
  apiKey: { count: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

describe("PlanLimitsService", () => {
  let service: PlanLimitsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlanLimitsService();
  });

  describe("getPlanLimits", () => {
    it("returns free plan limits by default", () => {
      const limits = service.getPlanLimits("free");
      expect(limits.maxMembers).toBe(5);
      expect(limits.maxSkills).toBe(10);
      expect(limits.maxExecutionsPerMonth).toBe(100);
      expect(limits.hasCustomRoles).toBe(false);
    });

    it("returns pro plan limits", () => {
      const limits = service.getPlanLimits("pro");
      expect(limits.maxMembers).toBe(25);
      expect(limits.maxSkills).toBe(-1); // unlimited
      expect(limits.maxExecutionsPerMonth).toBe(10000);
      expect(limits.hasCustomRoles).toBe(true);
    });

    it("returns enterprise plan limits", () => {
      const limits = service.getPlanLimits("enterprise");
      expect(limits.maxMembers).toBe(-1); // unlimited
      expect(limits.maxSkills).toBe(-1);
      expect(limits.hasSso).toBe(true);
    });

    it("falls back to free for unknown plan", () => {
      const limits = service.getPlanLimits("unknown");
      expect(limits.maxMembers).toBe(5);
    });
  });

  describe("getUsageStats", () => {
    it("returns usage counts for organization", async () => {
      mockPrisma.organizationMember.count.mockResolvedValue(3);
      mockPrisma.skill.count.mockResolvedValue(7);
      mockPrisma.execution.count.mockResolvedValue(50);
      mockPrisma.mcpServer.count.mockResolvedValue(2);
      mockPrisma.vaultEntry.count.mockResolvedValue(10);
      mockPrisma.customRole.count.mockResolvedValue(1);
      mockPrisma.apiKey.count.mockResolvedValue(2);

      const stats = await service.getUsageStats("org-1");

      expect(stats.members).toBe(3);
      expect(stats.skills).toBe(7);
      expect(stats.executionsThisMonth).toBe(50);
      expect(stats.mcpServers).toBe(2);
      expect(stats.vaultEntries).toBe(10);
      expect(stats.customRoles).toBe(1);
      expect(stats.apiKeys).toBe(2);
    });
  });

  describe("checkLimit", () => {
    it("allows when under limit", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "free" });
      mockPrisma.organizationMember.count.mockResolvedValue(2);
      mockPrisma.skill.count.mockResolvedValue(5);
      mockPrisma.execution.count.mockResolvedValue(10);
      mockPrisma.mcpServer.count.mockResolvedValue(1);
      mockPrisma.vaultEntry.count.mockResolvedValue(3);
      mockPrisma.customRole.count.mockResolvedValue(0);
      mockPrisma.apiKey.count.mockResolvedValue(0);

      const result = await service.checkLimit("org-1", "skills");
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(10);
    });

    it("blocks when at limit", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "free" });
      mockPrisma.organizationMember.count.mockResolvedValue(2);
      mockPrisma.skill.count.mockResolvedValue(10);
      mockPrisma.execution.count.mockResolvedValue(10);
      mockPrisma.mcpServer.count.mockResolvedValue(1);
      mockPrisma.vaultEntry.count.mockResolvedValue(3);
      mockPrisma.customRole.count.mockResolvedValue(0);
      mockPrisma.apiKey.count.mockResolvedValue(0);

      const result = await service.checkLimit("org-1", "skills");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("limit reached");
    });

    it("allows unlimited resources", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "pro" });
      mockPrisma.organizationMember.count.mockResolvedValue(2);
      mockPrisma.skill.count.mockResolvedValue(100);
      mockPrisma.execution.count.mockResolvedValue(10);
      mockPrisma.mcpServer.count.mockResolvedValue(1);
      mockPrisma.vaultEntry.count.mockResolvedValue(3);
      mockPrisma.customRole.count.mockResolvedValue(0);
      mockPrisma.apiKey.count.mockResolvedValue(0);

      const result = await service.checkLimit("org-1", "skills");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });
  });

  describe("enforceLimit", () => {
    it("passes when under limit", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "free" });
      mockPrisma.organizationMember.count.mockResolvedValue(2);
      mockPrisma.skill.count.mockResolvedValue(5);
      mockPrisma.execution.count.mockResolvedValue(10);
      mockPrisma.mcpServer.count.mockResolvedValue(1);
      mockPrisma.vaultEntry.count.mockResolvedValue(3);
      mockPrisma.customRole.count.mockResolvedValue(0);
      mockPrisma.apiKey.count.mockResolvedValue(0);

      await expect(
        service.enforceLimit("org-1", "skills")
      ).resolves.toBeUndefined();
    });

    it("throws ForbiddenError when at limit", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "free" });
      mockPrisma.organizationMember.count.mockResolvedValue(5);
      mockPrisma.skill.count.mockResolvedValue(10);
      mockPrisma.execution.count.mockResolvedValue(10);
      mockPrisma.mcpServer.count.mockResolvedValue(1);
      mockPrisma.vaultEntry.count.mockResolvedValue(3);
      mockPrisma.customRole.count.mockResolvedValue(0);
      mockPrisma.apiKey.count.mockResolvedValue(0);

      await expect(
        service.enforceLimit("org-1", "members")
      ).rejects.toThrow("limit reached");
    });
  });

  describe("hasFeature", () => {
    it("returns false for custom roles on free plan", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "free" });
      const result = await service.hasFeature("org-1", "hasCustomRoles");
      expect(result).toBe(false);
    });

    it("returns true for custom roles on pro plan", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "pro" });
      const result = await service.hasFeature("org-1", "hasCustomRoles");
      expect(result).toBe(true);
    });

    it("returns true for SSO on enterprise plan", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "enterprise" });
      const result = await service.hasFeature("org-1", "hasSso");
      expect(result).toBe(true);
    });

    it("returns false for SSO on free plan", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "free" });
      const result = await service.hasFeature("org-1", "hasSso");
      expect(result).toBe(false);
    });
  });

  describe("upgradePlan", () => {
    it("upgrades from free to pro", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "free" });
      mockPrisma.organization.update.mockResolvedValue({});

      await service.upgradePlan("org-1", "pro", "user-1");

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: { plan: "pro" },
      });
    });

    it("throws when trying to downgrade", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "enterprise" });

      await expect(
        service.upgradePlan("org-1", "free", "user-1")
      ).rejects.toThrow("Can only upgrade");
    });

    it("throws when organization not found", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.upgradePlan("org-1", "pro", "user-1")
      ).rejects.toThrow("Organization not found");
    });
  });

  describe("getUsageSummary", () => {
    it("returns plan, limits, usage, and percentages", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ plan: "free" });
      mockPrisma.organizationMember.count.mockResolvedValue(3);
      mockPrisma.skill.count.mockResolvedValue(5);
      mockPrisma.execution.count.mockResolvedValue(50);
      mockPrisma.mcpServer.count.mockResolvedValue(1);
      mockPrisma.vaultEntry.count.mockResolvedValue(3);
      mockPrisma.customRole.count.mockResolvedValue(0);
      mockPrisma.apiKey.count.mockResolvedValue(0);

      const summary = await service.getUsageSummary("org-1");

      expect(summary.plan).toBe("free");
      expect(summary.usage.members).toBe(3);
      expect(summary.percentages.members).toBe(60); // 3/5 = 60%
      expect(summary.percentages.skills).toBe(50);  // 5/10 = 50%
    });
  });
});
