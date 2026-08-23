import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { SkillRepository } from "@/repositories/SkillRepository";
import { createSkillSchema } from "@/validators/skillSchema";
import { SkillService } from "@/services/SkillService";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { previewStore } from "@/modules/graph/previewStore";
import { AgentGraphDefinition } from "@/types/graph";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

/**
 * POST /api/skills/sandbox
 *
 * Creates a temporary skill from marketplace data, generates a graph definition,
 * and starts a ghost-mode preview execution. Returns the preview ID for SSE streaming.
 *
 * Body: {
 *   skillName: string,
 *   skillDescription: string,
 *   steps: Array<{ order, action, description, requiredTool? }>,
 *   requiredServers: string[],
 *   inputData: Record<string, unknown>
 * }
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { skillName, skillDescription, steps, requiredServers, inputData } = body;

    if (!skillName || !steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "skillName and steps are required" },
        { status: 400 }
      );
    }

    // Build a graph definition from the marketplace skill steps
    const graph: AgentGraphDefinition = buildGraphFromSteps(
      skillName,
      skillDescription || "",
      steps,
      requiredServers || []
    );

    // Create a temporary skill record for the sandbox
    const safeName = `[Sandbox] ${skillName}`.slice(0, 100);
    const safePurpose = `Sandbox test run for: ${skillName}`.slice(0, 1000);

    const instructions = [
      `# ${skillName} (Sandbox)`,
      "",
      skillDescription || "",
      "",
      "## Steps",
      ...steps.map((s: { order: number; description: string }) => `${s.order}. ${s.description}`),
    ].join("\n");

    const allowedTools = ["*"];

    const validated = createSkillSchema.parse({
      userId,
      name: safeName,
      purpose: safePurpose,
      instructions: instructions.slice(0, 20000),
      allowedTools,
      graphDefinition: graph,
      maxExecutionSteps: Math.max(20, steps.length * 3),
      notes: `Sandbox test run — temporary skill for marketplace preview`,
    });

    const skill = await skillService.createSkill(validated);

    // Find the latest version (the one we just created)
    const versions = await skillRepo.findVersionsBySkillId(skill.id);
    const latestVersion = versions[versions.length - 1];

    if (!latestVersion) {
      return NextResponse.json(
        { error: "Failed to create sandbox skill version" },
        { status: 500 }
      );
    }

    // Create a preview session
    const previewId = `preview-${crypto.randomUUID()}`;
    previewStore.set(previewId, {
      userId,
      skillVersionId: latestVersion.id,
      graph,
      inputData: inputData || {},
      started: false,
      createdAt: Date.now(),
    });

    logger.info(
      { userId, skillName, previewId, graphNodes: graph.nodes.length },
      "Sandbox preview created"
    );

    return NextResponse.json({
      success: true,
      data: {
        previewId,
        skillId: skill.id,
        versionId: latestVersion.id,
        graph,
      },
    });
  } catch (error) {
    logger.error({ error }, "Sandbox creation failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sandbox failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/skills/sandbox?skillId=xxx
 * Clean up a sandbox skill after the test run.
 */
export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const skillId = url.searchParams.get("skillId");
    if (!skillId) {
      return NextResponse.json({ error: "skillId is required" }, { status: 400 });
    }

    // Verify ownership
    const skill = await skillRepo.findByIdForUser(skillId, userId);
    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // Only delete sandbox skills
    if (!skill.name.startsWith("[Sandbox]")) {
      return NextResponse.json({ error: "Not a sandbox skill" }, { status: 400 });
    }

    await skillService.deleteSkill(skillId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Sandbox cleanup failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}

// ────────────── Graph Builder ──────────────

function buildGraphFromSteps(
  skillName: string,
  description: string,
  steps: Array<{ order: number; action: string; description: string; requiredTool?: string }>,
  requiredServers: string[]
): AgentGraphDefinition {
  const nodes: AgentGraphDefinition["nodes"] = [];
  const edges: AgentGraphDefinition["edges"] = [];

  // Start node
  nodes.push({
    id: "start",
    type: "start",
    position: { x: 80, y: 280 },
    data: { label: "START", description: `Input: user query for ${skillName}` },
  });

  let prevId = "start";
  let x = 320;
  const y = 280;
  const xStep = 280;

  // If there are required servers, add MCP server nodes first
  if (requiredServers.length > 0) {
    for (let i = 0; i < requiredServers.length; i++) {
      const serverName = requiredServers[i];
      const nodeId = `server_${i}`;
      nodes.push({
        id: nodeId,
        type: "mcp_server",
        position: { x, y: y - 120 + i * 80 },
        data: {
          label: serverName,
          description: `Connect to ${serverName} MCP server`,
          mcpServerId: serverName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          mcpTransport: "SSE",
        },
      });
      edges.push({
        id: `edge_${prevId}_${nodeId}`,
        source: prevId,
        target: nodeId,
      });
      prevId = nodeId;
      x += xStep;
    }
  }

  // Add agent/tool nodes for each step
  for (const step of steps) {
    const nodeId = `step_${step.order}`;
    const isToolStep = step.requiredTool || step.action?.includes("-");

    if (isToolStep) {
      // Tool or MCP tool node
      const toolName = step.requiredTool || step.action;
      nodes.push({
        id: nodeId,
        type: "mcp_tool",
        position: { x, y },
        data: {
          label: step.description.slice(0, 50),
          description: step.description,
          mcpToolName: toolName,
          mcpToolServer: requiredServers[0]?.toLowerCase().replace(/[^a-z0-9]/g, "_") || "unknown",
          mcpToolParams: {},
        },
      });
    } else {
      // Agent node for reasoning steps
      nodes.push({
        id: nodeId,
        type: "agent",
        position: { x, y },
        data: {
          label: step.description.slice(0, 50),
          description: step.description,
          prompt: `You are executing step ${step.order} of the "${skillName}" workflow.\n\nTask: ${step.description}\n\nAnalyze the available context and produce the required output.`,
          allowedTools: ["*"],
        },
      });
    }

    edges.push({
      id: `edge_${prevId}_${nodeId}`,
      source: prevId,
      target: nodeId,
    });

    prevId = nodeId;
    x += xStep;
  }

  // Add approval gate before the final step (if there are steps that modify external state)
  const hasExternalAction = steps.some(
    (s) =>
      s.description.toLowerCase().includes("send") ||
      s.description.toLowerCase().includes("post") ||
      s.description.toLowerCase().includes("create") ||
      s.description.toLowerCase().includes("update") ||
      s.description.toLowerCase().includes("delete") ||
      s.description.toLowerCase().includes("notify") ||
      s.description.toLowerCase().includes("alert")
  );

  if (hasExternalAction) {
    const approvalId = "approval_gate";
    nodes.push({
      id: approvalId,
      type: "approval",
      position: { x, y },
      data: {
        label: "Review & Approve",
        description: "Human review before executing external actions",
        approvalReason: `Review the proposed actions for "${skillName}" before they are executed.`,
      },
    });
    edges.push({
      id: `edge_${prevId}_${approvalId}`,
      source: prevId,
      target: approvalId,
    });
    prevId = approvalId;
    x += xStep;
  }

  // End node
  nodes.push({
    id: "end",
    type: "end",
    position: { x, y },
    data: { label: "END", description: `Completed: ${skillName}` },
  });
  edges.push({
    id: `edge_${prevId}_end`,
    source: prevId,
    target: "end",
  });

  return { version: 1, nodes, edges };
}
