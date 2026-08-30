import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, notFound } from "@/lib/api/handlers";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { convertN8nToAgentGraph, convertN8nToWorkflowTemplate } from "@/lib/converters/n8n-converter";

export const revalidate = 600;

interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const workflowCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!id) return notFound("Workflow ID required");

  const cached = workflowCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      data: cached.data,
      cached: true,
    });
  }

  try {
    const res = await fetchWithRetry(`https://api.n8n.io/templates/workflows/${id}`, {
      timeoutMs: 15000,
      retries: 2,
    });

    if (!res.ok) {
      if (res.status === 404) return notFound(`n8n workflow #${id} not found`);
      throw new Error(`n8n API responded with status ${res.status}`);
    }

    const json = await res.json();
    const rawWorkflow = json.workflow || json;

    if (!rawWorkflow) {
      return notFound(`n8n workflow #${id} structure not found`);
    }

    const innerWorkflowData = rawWorkflow.workflow || rawWorkflow;
    const nodes = innerWorkflowData.nodes || [];
    const connections = innerWorkflowData.connections || {};

    const convertedGraph = convertN8nToAgentGraph({
      id: rawWorkflow.id,
      name: rawWorkflow.name,
      description: rawWorkflow.description,
      nodes,
      connections,
    });

    const convertedTemplate = convertN8nToWorkflowTemplate({
      id: rawWorkflow.id,
      name: rawWorkflow.name,
      description: rawWorkflow.description,
      nodes,
    });

    const payload = {
      id: rawWorkflow.id,
      name: rawWorkflow.name,
      description: rawWorkflow.description,
      views: rawWorkflow.views || rawWorkflow.totalViews || 0,
      createdAt: rawWorkflow.createdAt,
      user: rawWorkflow.user,
      rawWorkflowJson: innerWorkflowData,
      nodeCount: nodes.length,
      convertedGraph,
      convertedTemplate,
      url: `https://n8n.io/workflows/${id}`,
    };

    workflowCache.set(id, {
      data: payload,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: payload,
    });
  } catch (error: unknown) {
    console.error(`[n8n workflow detail API error for #${id}]:`, error);
    const message = error instanceof Error ? error.message : `Failed to fetch n8n workflow #${id}`;
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 502 }
    );
  }
}
