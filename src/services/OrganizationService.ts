/**
 * Organization Service
 *
 * Manages organizations, members, and invitations for multi-tenancy.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { RBACService, ForbiddenError, OrgRole } from "./RBACService";
import { AuditService } from "./AuditService";

// ────────────── Types ──────────────

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  plan?: string;
  billingEmail?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  billingEmail?: string;
  settings?: Record<string, unknown>;
}

export interface InviteMemberInput {
  email: string;
  role?: OrgRole;
}

export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingEmail: string | null;
  settings: Record<string, unknown>;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberDTO {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  role: OrgRole;
  customRoleId?: string | null;
  joinedAt: Date;
}

export interface InvitationDTO {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: Date;
  createdAt: Date;
}

// ────────────── Service ──────────────

export class OrganizationService {
  private rbacService: RBACService;
  private auditService: AuditService;

  constructor() {
    this.rbacService = new RBACService();
    this.auditService = new AuditService();
  }

  /**
   * Create a new organization (user becomes OWNER)
   */
  async create(
    userId: string,
    input: CreateOrganizationInput
  ): Promise<OrganizationDTO> {
    // Generate slug if not provided
    const slug = input.slug || this.generateSlug(input.name);

    // Check slug uniqueness
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new Error(`Organization slug "${slug}" already exists`);
    }

    const organization = await prisma.organization.create({
      data: {
        name: input.name,
        slug,
        plan: input.plan || "enterprise",
        billingEmail: input.billingEmail,
        settings: {
          sso: true,
          auditExport: true,
          customRoles: true,
        },
        members: {
          create: {
            userId,
            role: "OWNER",
            permissions: [],
          },
        },
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    // Log audit event
    await this.auditService.log({
      action: "ORG_CREATED",
      userId,
      organizationId: organization.id,
      resourceType: "organization",
      details: { name: input.name, slug },
    });

    logger.info({ organizationId: organization.id, userId }, "Organization created");

    return this.toDTO(organization);
  }

  /**
   * Get organization by ID
   */
  async getById(
    userId: string,
    organizationId: string
  ): Promise<OrganizationDTO | null> {
    // Check membership
    const membership = await this.rbacService.getOrgMembership(userId, organizationId);
    if (!membership) return null;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: { select: { members: true } },
      },
    });

    if (!organization) return null;
    return this.toDTO(organization);
  }

  /**
   * List user's organizations
   */
  async listUserOrganizations(userId: string): Promise<OrganizationDTO[]> {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
    });

    return memberships.map((m) => this.toDTO(m.organization));
  }

  /**
   * Update organization settings
   */
  async update(
    userId: string,
    organizationId: string,
    input: UpdateOrganizationInput
  ): Promise<OrganizationDTO> {
    // Check permission
    await this.rbacService.requireOrgRole(userId, organizationId, "ADMIN");

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.billingEmail !== undefined && { billingEmail: input.billingEmail }),
        ...(input.settings !== undefined && { settings: input.settings as import("@prisma/client").Prisma.InputJsonValue }),
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    // Log audit event
    await this.auditService.log({
      action: "ORG_UPDATED",
      userId,
      organizationId,
      resourceType: "organization",
      details: input as Record<string, unknown>,
    });

    logger.info({ organizationId, userId }, "Organization updated");
    return this.toDTO(organization);
  }

  /**
   * Delete organization (Owner only)
   * Cascades cleanup: members, custom roles, invitations, audit logs,
   * API keys, and dissociates skills/executions/MCP servers/vault entries.
   */
  async delete(userId: string, organizationId: string): Promise<void> {
    // Only owner can delete
    await this.rbacService.requireOrgRole(userId, organizationId, "OWNER");

    // Safety: prevent deleting if this is the user's last organization
    const membershipCount = await prisma.organizationMember.count({
      where: { userId },
    });
    if (membershipCount <= 1) {
      throw new Error(
        "Cannot delete your only organization. Create another organization first, or leave this one."
      );
    }

    // Log audit event before deletion
    await this.auditService.log({
      action: "ORG_DELETED",
      userId,
      organizationId,
      resourceType: "organization",
    });

    // Clean up all related data in a transaction to avoid FK constraint violations.
    // Relations lack onDelete: Cascade in the Prisma schema, so we must
    // manually delete child rows before removing the organization row.
    await prisma.$transaction(
      async (tx) => {
        // 1. Members
        await tx.organizationMember.deleteMany({ where: { organizationId } });

        // 2. Invitations
        await tx.invitation.deleteMany({ where: { organizationId } });

        // 3. Custom roles
        await tx.customRole.deleteMany({ where: { organizationId } });

        // 4. Audit logs
        await tx.auditLog.deleteMany({ where: { organizationId } });

        // 5. API keys
        await tx.apiKey.deleteMany({ where: { organizationId } });

        // 6. Dissociate resources (set organizationId to null, do NOT delete them)
        await tx.skill.updateMany({
          where: { organizationId },
          data: { organizationId: null },
        });
        await tx.execution.updateMany({
          where: { organizationId },
          data: { organizationId: null },
        });
        await tx.mcpServer.updateMany({
          where: { organizationId },
          data: { organizationId: null },
        });
        await tx.vaultEntry.updateMany({
          where: { organizationId },
          data: { organizationId: null },
        });

        // 7. Finally delete the organization itself
        await tx.organization.delete({ where: { id: organizationId } });
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    logger.info({ organizationId, userId }, "Organization deleted");
  }

  /**
   * Invite member to organization
   */
  async inviteMember(
    userId: string,
    organizationId: string,
    input: InviteMemberInput
  ): Promise<InvitationDTO> {
    // Check permission
    await this.rbacService.requireOrgRole(userId, organizationId, "ADMIN");

    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: input.email },
      },
    });
    if (existingMember) {
      throw new Error("User is already a member of this organization");
    }

    // Check for pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        organizationId,
        email: input.email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) {
      throw new Error("Invitation already pending for this email");
    }

    // Create invitation
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to accept

    const invitation = await prisma.invitation.create({
      data: {
        organizationId,
        email: input.email,
        role: input.role || "MEMBER",
        token,
        invitedBy: userId,
        expiresAt,
      },
    });

    // Log audit event
    await this.auditService.logMemberInvited({
      userId,
      organizationId,
      targetEmail: input.email,
      role: input.role || "MEMBER",
    });

    // TODO: Send invitation email
    logger.info({ invitationId: invitation.id, email: input.email, organizationId }, "Invitation sent");

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role as OrgRole,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(
    userId: string,
    token: string
  ): Promise<MemberDTO> {
    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new Error("Invalid invitation token");
    }

    if (invitation.acceptedAt) {
      throw new Error("Invitation already accepted");
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error("Invitation has expired");
    }

    // Check if user email matches invitation
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.email !== invitation.email) {
      throw new Error("Invitation email does not match your account");
    }

    // Check if already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new Error("You are already a member of this organization");
    }

    // Create membership
    const membership = await prisma.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
        permissions: [],
        invitedBy: invitation.invitedBy,
      },
      include: {
        user: true,
      },
    });

    // Mark invitation as accepted
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    // Log audit event
    await this.auditService.logMemberJoined({
      userId,
      organizationId: invitation.organizationId,
      role: invitation.role,
    });

    logger.info({ userId, organizationId: invitation.organizationId }, "Invitation accepted");

    return {
      id: membership.id,
      userId: membership.userId,
      userName: membership.user.name,
      userEmail: membership.user.email,
      role: membership.role as OrgRole,
      joinedAt: membership.joinedAt,
    };
  }

  /**
   * List organization members
   */
  async listMembers(
    userId: string,
    organizationId: string
  ): Promise<MemberDTO[]> {
    // Check membership
    const membership = await this.rbacService.getOrgMembership(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError("Not a member of this organization");
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name,
      userEmail: m.user.email,
      role: m.role as OrgRole,
      customRoleId: m.customRoleId ?? null,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Remove member from organization
   */
  async removeMember(
    userId: string,
    organizationId: string,
    targetUserId: string
  ): Promise<void> {
    // Check permission
    const permissions = await this.rbacService.requireOrgRole(
      userId,
      organizationId,
      "ADMIN"
    );

    // Cannot remove yourself (use leave instead)
    if (userId === targetUserId) {
      throw new Error("Cannot remove yourself. Use leave organization instead.");
    }

    // Check target is a member
    const targetMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMembership) {
      throw new Error("User is not a member of this organization");
    }

    // Non-owners cannot remove owners
    if (targetMembership.role === "OWNER" && !permissions.isOwner) {
      throw new ForbiddenError("Only owners can remove other owners");
    }

    // Log audit event
    await this.auditService.logMemberRemoved({
      userId,
      organizationId,
      targetUserId,
    });

    await prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
    });

    logger.info({ organizationId, targetUserId, removedBy: userId }, "Member removed");
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    userId: string,
    organizationId: string,
    targetUserId: string,
    newRole: OrgRole
  ): Promise<MemberDTO> {
    // Check permission
    const permissions = await this.rbacService.requireOrgRole(
      userId,
      organizationId,
      "ADMIN"
    );

    // Cannot change your own role
    if (userId === targetUserId) {
      throw new Error("Cannot change your own role");
    }

    // Check target is a member
    const targetMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
      include: { user: true },
    });

    if (!targetMembership) {
      throw new Error("User is not a member of this organization");
    }

    // Non-owners cannot promote to owner
    if (newRole === "OWNER" && !permissions.isOwner) {
      throw new ForbiddenError("Only owners can promote to owner");
    }

    // Non-owners cannot modify owners
    if (targetMembership.role === "OWNER" && !permissions.isOwner) {
      throw new ForbiddenError("Only owners can modify owner role");
    }

    // Log audit event
    await this.auditService.logMemberRoleChanged({
      userId,
      organizationId,
      targetUserId,
      oldRole: targetMembership.role,
      newRole,
    });

    const updatedMembership = await prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUserId,
        },
      },
      data: { role: newRole },
      include: { user: true },
    });

    logger.info({ organizationId, targetUserId, newRole, updatedBy: userId }, "Member role updated");

    return {
      id: updatedMembership.id,
      userId: updatedMembership.userId,
      userName: updatedMembership.user.name,
      userEmail: updatedMembership.user.email,
      role: updatedMembership.role as OrgRole,
      joinedAt: updatedMembership.joinedAt,
    };
  }

  /**
   * Leave organization
   */
  async leaveOrganization(userId: string, organizationId: string): Promise<void> {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error("You are not a member of this organization");
    }

    // Owner cannot leave if they're the only owner
    if (membership.role === "OWNER") {
      const ownerCount = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: "OWNER",
        },
      });

      if (ownerCount === 1) {
        throw new Error(
          "Owner cannot leave organization. Transfer ownership or delete the organization."
        );
      }
    }

    await prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    logger.info({ organizationId, userId }, "Left organization");
  }

  /**
   * List pending invitations for organization
   */
  async listInvitations(
    userId: string,
    organizationId: string
  ): Promise<InvitationDTO[]> {
    // Check permission
    await this.rbacService.requireOrgRole(userId, organizationId, "ADMIN");

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role as OrgRole,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(
    userId: string,
    organizationId: string,
    invitationId: string
  ): Promise<void> {
    // Check permission
    await this.rbacService.requireOrgRole(userId, organizationId, "ADMIN");

    // Log audit event
    await this.auditService.log({
      action: "INVITATION_CANCELLED",
      userId,
      organizationId,
      resourceId: invitationId,
      resourceType: "invitation",
    });

    await prisma.invitation.delete({
      where: {
        id: invitationId,
        organizationId,
      },
    });

    logger.info({ invitationId, organizationId, cancelledBy: userId }, "Invitation cancelled");
  }

  /**
   * Ensure user has a default organization.
   * Creates a "Personal Workspace" if none exists.
   * Auto-migrates existing resources to the default org.
   */
  async ensureDefaultOrganization(userId: string): Promise<OrganizationDTO> {
    // Check if user already has an organization
    const existingMemberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    // Return existing org if found
    if (existingMemberships.length > 0) {
      return this.toDTO(existingMemberships[0].organization);
    }

    // Create default organization
    const slug = `personal-${userId.slice(0, 8)}`;

    const organization = await prisma.organization.create({
      data: {
        name: "Personal Workspace",
        slug,
        plan: "free",
        members: {
          create: {
            userId,
            role: "OWNER",
            permissions: [],
          },
        },
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    // Auto-migrate existing resources to the default org
    await this.migrateExistingResources(userId, organization.id);

    logger.info({ organizationId: organization.id, userId }, "Default organization created");

    return this.toDTO(organization);
  }

  /**
   * Migrate existing user resources to their organization
   */
  private async migrateExistingResources(userId: string, organizationId: string): Promise<void> {
    try {
      // Migrate skills
      await prisma.skill.updateMany({
        where: { userId, organizationId: null },
        data: { organizationId },
      });

      // Migrate executions
      await prisma.execution.updateMany({
        where: { userId, organizationId: null },
        data: { organizationId },
      });

      // Migrate MCP servers
      await prisma.mcpServer.updateMany({
        where: { userId, organizationId: null },
        data: { organizationId },
      });

      // Migrate vault entries
      await prisma.vaultEntry.updateMany({
        where: { userId, organizationId: null },
        data: { organizationId },
      });

      logger.info({ userId, organizationId }, "Existing resources migrated to organization");
    } catch (error) {
      // Log but don't fail - migration is best-effort
      logger.error({ userId, organizationId, error }, "Failed to migrate some resources");
    }
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
  }

  private toDTO(organization: import("@prisma/client").Organization & { _count?: { members?: number } }): OrganizationDTO {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      billingEmail: organization.billingEmail,
      settings: (organization.settings as Record<string, unknown>) || {},
      memberCount: organization._count?.members || 0,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }
}
