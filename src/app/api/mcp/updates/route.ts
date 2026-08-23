import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { McpClientService } from "@/services/McpClientService";
import { SkillService } from "@/services/SkillService";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { ApplyToolUpdateInput, McpToolUpdate } from "@/types/mcp";
import { applyToolUpdates } from "@/modules/mcp/toolDiff";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const mcpRepo = new McpServerRepository();
const mcpService = new McpClientService(mcpRepo);
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

/**
 * GET /api/mcp/updates — List all pending tool updates across all servers.
 */
export async function GET(_request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updates = mcpService.getAllPendingUpdates();

    // Filter to only updates for servers owned by this user
    const servers = await mcpRepo.findByUserId(userId);
    const serverIds = new Set(servers.map((s) => s.id));
    const userUpdates = updates.filter((u) => serverIds.has(u.serverId));

    // Enrich with affected skill info
    const enrichedUpdates: (McpToolUpdate & { affectedSkillNames: string[] })[] = [];
    for (const update of userUpdates) {
      // Find skills that reference tools from this server
      const allSkills = await skillService.listSkills(userId, {});
      const affectedSkills = allSkills.items.filter((skill) => {
        const version = skill.publishedVersion ?? skill.currentDraft;
        if (!version) return false;
        const allowedTools = (version.allowedTools ?? []) as string[];
        return allowedTools.some((t) => t.startsWith(`mcp_${update.serverId}_`));
      });

      enrichedUpdates.push({
        ...update,
        affectedSkillIds: affectedSkills.map((s) => s.id),
        affectedSkillNames: affectedSkills.map((s) => s.name),
      });
    }

    return NextResponse.json({ success: true, data: enrichedUpdates });
  } catch (error) {
    logger.error({ error }, "Failed to list MCP tool updates");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/updates/apply — Apply a tool update to skill drafts.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ApplyToolUpdateInput;
    if (!body.updateId) {
      return NextResponse.json({ error: "updateId is required" }, { status: 400 });
    }

    // Find the pending update
    const updates = mcpService.getAllPendingUpdates();
    const update = updates.find((u) => u.id === body.updateId);
    if (!update) {
      return NextResponse.json({ error: "Update not found or already applied" }, { status: 404 });
    }

    // Verify ownership
    const server = await mcpRepo.findByIdForUser(update.serverId, userId);
    if (!server) {
      return NextResponse.json({ error: "Server not found or access denied" }, { status: 403 });
    }

    // Determine which changes to apply
    const changesToApply = body.toolNames
      ? update.changes.filter((c) => body.toolNames!.includes(c.toolName))
      : update.changes;

    // Determine which skills to update
    const allSkills = await skillService.listSkills(userId, {});
    const targetSkills = body.skillIds
      ? allSkills.items.filter((s) => body.skillIds!.includes(s.id))
      : allSkills.items.filter((skill) => {
          const version = skill.publishedVersion ?? skill.currentDraft;
          if (!version) return false;
          const allowedTools = (version.allowedTools ?? []) as string[];
          return allowedTools.some((t) => t.startsWith(`mcp_${update.serverId}_`));
        });

    let updatedCount = 0;
    const errors: string[] = [];

    for (const skill of targetSkills) {
      try {
        const version = skill.currentDraft ?? skill.publishedVersion;
        if (!version) continue;

        const currentAllowedTools = (version.allowedTools ?? []) as string[];
        const updatedTools = applyToolUpdates(
          currentAllowedTools,
          changesToApply,
          update.serverId,
          body.toolNames
        );

        // Only update if something changed
        if (JSON.stringify(updatedTools.sort()) !== JSON.stringify(currentAllowedTools.sort())) {
          await skillService.updateSkill(skill.id, userId, {
            allowedTools: updatedTools,
          });
          updatedCount++;
        }
      } catch (err) {
        errors.push(`Failed to update skill "${skill.name}": ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Clear the pending update
    mcpService.clearPendingUpdate(update.serverId);

    // Audit log
    await auditRepo.log({
      userId,
      action: "MCP_TOOL_UPDATE_APPLIED",
      details: {
        updateId: update.id,
        serverId: update.serverId,
        changesApplied: changesToApply.length,
        skillsUpdated: updatedCount,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        updateId: update.id,
        changesApplied: changesToApply.length,
        skillsUpdated: updatedCount,
        errors,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to apply MCP tool update");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
