import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { SkillRepository } from "@/repositories/SkillRepository";
import { validateUserInput } from "@/modules/execution/executor/validation";
import { isValidGraph, AgentGraphDefinition } from "@/types/graph";
import { previewStore } from "@/modules/graph/previewStore";

export const dynamic = "force-dynamic";

const skillRepo = new SkillRepository();

interface PreviewBody {
  skillVersionId?: string;
  graph?: AgentGraphDefinition;
  inputData?: Record<string, unknown>;
}

/**
 * Register a ghost-mode preview: validates the graph + input against the
 * skill version, then returns a `preview-…` id. The actual dry-run is kicked
 * off by the SSE stream route on first subscriber (so no events are missed).
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { skillVersionId, graph, inputData } = body;
  if (!skillVersionId || !graph) {
    return NextResponse.json({ error: "skillVersionId and graph are required" }, { status: 400 });
  }
  if (!isValidGraph(graph)) {
    return NextResponse.json(
      { error: "The visual graph is incomplete — add a START node, an END node, and valid connections." },
      { status: 400 }
    );
  }

  const version = await skillRepo.findVersionById(skillVersionId);
  if (!version) {
    return NextResponse.json({ error: "Skill version not found" }, { status: 404 });
  }
  const skill = await skillRepo.findByIdForUser(version.skillId, userId);
  if (!skill) {
    return NextResponse.json({ error: "Skill not found or you do not have access to it" }, { status: 404 });
  }

  const payload = (inputData ?? {}) as Record<string, unknown>;
  try {
    validateUserInput(payload, version);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid execution input" },
      { status: 400 }
    );
  }

  const previewId = `preview-${crypto.randomUUID()}`;
  previewStore.set(previewId, {
    userId,
    skillVersionId,
    graph,
    inputData: payload,
    started: false,
    createdAt: Date.now(),
  });

  return NextResponse.json({ previewId });
}
