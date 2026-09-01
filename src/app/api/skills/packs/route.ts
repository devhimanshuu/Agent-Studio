import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPackById, SKILL_PACKS } from "@/data/skillPacks";
import { InstallPackInput, PackInstallationState } from "@/types/skillPacks";
import { createSkillSchema } from "@/validators/skillSchema";
import { apiServices } from "@/lib/api/services";
import { logger } from "@/lib/logger";
import { handleApiError } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

const { skillService, auditRepo, mcpService } = apiServices();

/**
 * GET /api/skills/packs — List all available skill packs
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get existing servers to check which are already connected
    const existingServers = await mcpService.listServers(userId);
    const serverNames = new Set(existingServers.map((s) => s.name.toLowerCase()));

    // Enrich packs with installation status
    const packs = SKILL_PACKS.map((pack) => {
      const serversInstalled = pack.servers.filter((s) =>
        serverNames.has(s.name.toLowerCase())
      ).length;
      return {
        ...pack,
        serversInstalled,
        allServersConnected: serversInstalled === pack.servers.length,
      };
    });

    return NextResponse.json({ success: true, data: packs });
  } catch (error) {
    logger.error({ error }, "Failed to list skill packs");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/skills/packs — Install a skill pack (mount servers + create skills)
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as InstallPackInput;
    if (!body.packId) {
      return NextResponse.json({ error: "packId is required" }, { status: 400 });
    }

    const pack = getPackById(body.packId);
    if (!pack) {
      return NextResponse.json({ error: `Pack "${body.packId}" not found` }, { status: 404 });
    }

    logger.info({ packId: pack.id, packName: pack.name }, "Starting pack installation");

    const state: PackInstallationState = {
      packId: pack.id,
      status: "installing",
      serversInstalled: 0,
      serversTotal: pack.servers.length,
      skillsInstalled: 0,
      skillsTotal: pack.skills.length,
      errors: [],
      installedServerIds: [],
      installedSkillIds: [],
      startedAt: new Date().toISOString(),
    };

    // ── Phase 1: Mount MCP Servers ──
    const existingServers = await mcpService.listServers(userId);
    const serverIdMap = new Map<number, string>(); // pack server index → DB server ID

    const serverIndices = body.serverIndices ?? pack.servers.map((_, i) => i);

    for (const idx of serverIndices) {
      const serverDef = pack.servers[idx];
      if (!serverDef) continue;

      try {
        // Check if already connected
        const existing = existingServers.find(
          (s) => s.name.toLowerCase() === serverDef.name.toLowerCase()
        );

        if (existing) {
          serverIdMap.set(idx, existing.id);
          state.installedServerIds.push(existing.id);
          state.serversInstalled++;
          continue;
        }

        // Auto-mount: search directory or use Composio
        let serverId: string | null = null;

        if (serverDef.composioSlug) {
          // Composio auto-mount
          try {
            const sessionRes = await fetch(
              new URL("/api/mcp/composio", request.url),
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toolkits: [serverDef.composioSlug] }),
              }
            ).then((r) => r.json());

            if (sessionRes.success && sessionRes.data?.mcpUrl) {
              const server = await mcpService.createServer({
                userId,
                name: `${serverDef.name} [Composio]`,
                transport: "SSE",
                endpointUrl: sessionRes.data.mcpUrl,
                headers: sessionRes.data.mcpHeaders || undefined,
              });
              serverId = server.id;
              void mcpService.connect(server.id, userId).catch(() => {});
            }
          } catch (err) {
            logger.warn({ serverName: serverDef.name, error: err }, "Failed to mount Composio server");
          }
        } else {
          // Directory search
          try {
            const dirRes = await fetch(
              new URL(
                `/api/mcp/directory?q=${encodeURIComponent(serverDef.searchQuery)}&source=${serverDef.directorySource || "ALL"}`,
                request.url
              )
            ).then((r) => r.json());

            const match = (dirRes.data || []).find((s: { name: string }) =>
              s.name.toLowerCase().includes(serverDef.searchQuery.toLowerCase())
            );

            if (match) {
              const transport = match.endpointUrl ? "SSE" : "STDIO";
              const command =
                match.command ||
                (transport === "STDIO"
                  ? `npx -y ${match.id.replace(/^pub-/, "")}`
                  : undefined);

              const server = await mcpService.createServer({
                userId,
                name: match.name,
                transport,
                endpointUrl: transport === "SSE" ? match.endpointUrl : undefined,
                command: transport === "STDIO" ? command : undefined,
              });
              serverId = server.id;
              void mcpService.connect(server.id, userId).catch(() => {});
            }
          } catch (err) {
            logger.warn({ serverName: serverDef.name, error: err }, "Failed to mount directory server");
          }
        }

        if (serverId) {
          serverIdMap.set(idx, serverId);
          state.installedServerIds.push(serverId);
          state.serversInstalled++;
        } else {
          state.errors.push(`Failed to mount server: ${serverDef.name}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        state.errors.push(`Server "${serverDef.name}": ${msg}`);
        logger.error({ serverName: serverDef.name, error: err }, "Server mount failed");
      }
    }

    // ── Phase 2: Create Skill Records ──
    const skillIndices = body.skillIndices ?? pack.skills.map((_, i) => i);

    for (const idx of skillIndices) {
      const skillDef = pack.skills[idx];
      if (!skillDef) continue;

      try {
        // Resolve required server IDs from the pack
        const mountedServerIds = skillDef.requiredServerIndices
          .map((si) => serverIdMap.get(si))
          .filter(Boolean) as string[];

        // Build allowed tools
        const allowedTools = new Set<string>();
        for (const pattern of skillDef.allowedToolPatterns) {
          allowedTools.add(pattern);
        }
        for (const sid of mountedServerIds) {
          allowedTools.add(`mcp_${sid}_*`);
        }
        allowedTools.add("*");

        // Build instructions with pack context
        const instructions = [
          `# ${skillDef.name}`,
          "",
          `**Pack:** ${pack.name}`,
          `**Purpose:** ${skillDef.purpose}`,
          "",
          skillDef.instructions,
          "",
          "---",
          `*Installed as part of the ${pack.name} solution stack.*`,
        ].join("\n");

        const safeName = skillDef.name.slice(0, 100);
        const safePurpose = skillDef.purpose.slice(0, 1000);

        const validated = createSkillSchema.parse({
          userId,
          name: safeName,
          purpose: safePurpose,
          instructions: instructions.slice(0, 20000),
          allowedTools: Array.from(allowedTools).slice(0, 30),
          maxExecutionSteps: Math.max(10, skillDef.steps.length * 3),
          notes: `Installed from ${pack.name} pack (ID: ${pack.id})`,
        });
        const createRes = await skillService.createSkill(validated);

        if (createRes && createRes.id) {
          state.installedSkillIds.push(createRes.id);
          state.skillsInstalled++;
        } else {
          state.errors.push(`Failed to create skill: ${skillDef.name}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        state.errors.push(`Skill "${skillDef.name}": ${msg}`);
        logger.error({ skillName: skillDef.name, error: err }, "Skill creation failed");
      }
    }

    // ── Finalize ──
    state.status =
      state.errors.length === 0
        ? "completed"
        : state.serversInstalled > 0 || state.skillsInstalled > 0
        ? "partial"
        : "failed";
    state.completedAt = new Date().toISOString();

    // Audit log
    await auditRepo.log({
      userId,
      action: "SKILL_PACK_INSTALLED",
      details: {
        packId: pack.id,
        packName: pack.name,
        serversInstalled: state.serversInstalled,
        skillsInstalled: state.skillsInstalled,
        errors: state.errors.length,
      },
    });

    logger.info(
      {
        packId: pack.id,
        status: state.status,
        servers: state.serversInstalled,
        skills: state.skillsInstalled,
        errors: state.errors.length,
      },
      "Pack installation completed"
    );

    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    logger.error({ error }, "Failed to install skill pack");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
