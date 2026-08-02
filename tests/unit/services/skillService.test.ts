import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillService } from "@/services/SkillService";
import { ISkillRepository } from "@/repositories/interfaces/ISkillRepository";
import { IAuditLogRepository } from "@/repositories/interfaces/IAuditLogRepository";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";

function makeSkill(overrides: Partial<SkillDTO> = {}): SkillDTO {
  return {
    id: "skill_1",
    userId: "user_1",
    name: "Sentiment Analyzer",
    purpose: "Analyzes sentiment.",
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeVersion(overrides: Partial<SkillVersionDTO> = {}): SkillVersionDTO {
  return {
    id: "version_1",
    skillId: "skill_1",
    versionNumber: 1,
    status: "DRAFT",
    inputSchema: {},
    outputSchema: {},
    instructions: "Classify sentiment.",
    examples: [],
    allowedTools: ["calculator"],
    actionsRequiringApproval: [],
    maxExecutionSteps: 10,
    createdAt: new Date(),
    ...overrides,
  };
}

function setup() {
  const repo = {
    findById: vi.fn(),
    findByIdForUser: vi.fn(),
    findByUserId: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    updateDraft: vi.fn(),
    duplicate: vi.fn(),
    archive: vi.fn(),
    deleteDraft: vi.fn(),
    publishVersion: vi.fn(),
    findVersionById: vi.fn(),
    findVersionsBySkillId: vi.fn(),
  };

  const auditRepo = {
    log: vi.fn().mockResolvedValue({ id: "log_1", action: "LOG", details: {}, timestamp: new Date() }),
    findByUserId: vi.fn(),
  };

  const service = new SkillService(repo as unknown as ISkillRepository, auditRepo as unknown as IAuditLogRepository);
  return { repo: vi.mocked(repo), auditRepo: vi.mocked(auditRepo), service };
}

describe("SkillService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createSkill", () => {
    it("creates a skill and writes an audit log", async () => {
      const { repo, auditRepo, service } = setup();
      const created = makeSkill({ name: "New Skill" });
      repo.create.mockResolvedValue(created);

      const result = await service.createSkill({ userId: "user_1", name: "New Skill", purpose: "Does things." });

      expect(result).toEqual(created);
      expect(repo.create).toHaveBeenCalledOnce();
      expect(auditRepo.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "SKILL_CREATED", userId: "user_1" })
      );
    });
  });

  describe("updateSkill", () => {
    it("updates the draft owned by the user", async () => {
      const { repo, auditRepo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(makeSkill());
      repo.updateDraft.mockResolvedValue(makeVersion({ versionNumber: 2 }));

      const result = await service.updateSkill("skill_1", "user_1", { instructions: "Updated." });

      expect(result.versionNumber).toBe(2);
      expect(repo.updateDraft).toHaveBeenCalledWith("skill_1", "user_1", { instructions: "Updated." });
      expect(auditRepo.log).toHaveBeenCalledWith(expect.objectContaining({ action: "SKILL_UPDATED" }));
    });

    it("throws for a skill the user does not own", async () => {
      const { repo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(null);

      await expect(service.updateSkill("skill_1", "user_2", { instructions: "x" })).rejects.toThrow(
        "not found or you do not have access"
      );
      expect(repo.updateDraft).not.toHaveBeenCalled();
    });
  });

  describe("publishVersion", () => {
    it("publishes a version and logs the event", async () => {
      const { repo, auditRepo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(makeSkill({ status: "DRAFT" }));
      repo.publishVersion.mockResolvedValue(makeVersion({ status: "PUBLISHED", versionNumber: 1 }));

      const result = await service.publishVersion("skill_1", "user_1", "version_1");

      expect(result.status).toBe("PUBLISHED");
      expect(auditRepo.log).toHaveBeenCalledWith(expect.objectContaining({ action: "SKILL_PUBLISHED" }));
    });

    it("throws when the skill is not owned by the caller", async () => {
      const { repo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(null);

      await expect(service.publishVersion("skill_1", "user_2", "version_1")).rejects.toThrow("do not have access");
      expect(repo.publishVersion).not.toHaveBeenCalled();
    });
  });

  describe("archiveSkill", () => {
    it("archives the skill and logs the event", async () => {
      const { repo, auditRepo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(makeSkill());
      repo.archive.mockResolvedValue(makeSkill({ status: "ARCHIVED" }));

      const result = await service.archiveSkill("skill_1", "user_1");

      expect(result.status).toBe("ARCHIVED");
      expect(auditRepo.log).toHaveBeenCalledWith(expect.objectContaining({ action: "SKILL_ARCHIVED" }));
    });
  });

  describe("duplicateSkill", () => {
    it("duplicates the skill and logs the event", async () => {
      const { repo, auditRepo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(makeSkill());
      repo.duplicate.mockResolvedValue(makeSkill({ id: "skill_2", name: "Sentiment Analyzer (Copy)" }));

      const result = await service.duplicateSkill("skill_1", "user_1");

      expect(result.id).toBe("skill_2");
      expect(auditRepo.log).toHaveBeenCalledWith(expect.objectContaining({ action: "SKILL_DUPLICATED" }));
    });
  });

  describe("deleteSkill", () => {
    it("deletes a draft skill and logs the event", async () => {
      const { repo, auditRepo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(makeSkill({ status: "DRAFT" }));
      repo.deleteDraft.mockResolvedValue(undefined);

      await service.deleteSkill("skill_1", "user_1");

      expect(repo.deleteDraft).toHaveBeenCalledWith("skill_1", "user_1");
      expect(auditRepo.log).toHaveBeenCalledWith(expect.objectContaining({ action: "SKILL_DELETED" }));
    });

    it("does not attempt deletion for an unauthorized user", async () => {
      const { repo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(null);

      await expect(service.deleteSkill("skill_1", "user_2")).rejects.toThrow("do not have access");
      expect(repo.deleteDraft).not.toHaveBeenCalled();
    });
  });

  describe("getSkillForUser (ownership)", () => {
    it("returns null when the skill belongs to another user", async () => {
      const { repo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(null);

      const result = await service.getSkillForUser("skill_1", "user_2");
      expect(result).toBeNull();
    });

    it("returns the skill for the owner", async () => {
      const { repo, service } = setup();
      repo.findByIdForUser.mockResolvedValue(makeSkill());

      const result = await service.getSkillForUser("skill_1", "user_1");
      expect(result?.id).toBe("skill_1");
    });
  });

  describe("listSkills", () => {
    it("delegates to the repository with the query", async () => {
      const { repo, service } = setup();
      repo.list.mockResolvedValue({ items: [makeSkill()], total: 1 });

      const result = await service.listSkills("user_1", { search: "sentiment", status: "DRAFT" });

      expect(repo.list).toHaveBeenCalledWith("user_1", { search: "sentiment", status: "DRAFT" });
      expect(result.total).toBe(1);
    });
  });
});
