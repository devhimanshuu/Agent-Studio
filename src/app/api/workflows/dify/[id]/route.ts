import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, notFound } from "@/lib/api/handlers";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { logger } from "@/lib/logger";
import {
  convertDifyToAgentGraph,
  convertDifyToWorkflowTemplate,
  parseDifyDslYaml,
  DifyWorkflowData,
  DifyNode,
  DifyEdge,
} from "@/lib/converters/dify-converter";

export const revalidate = 600;

interface CacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

const difyDetailCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!id) return notFound("Template ID required");

  const cached = difyDetailCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      data: cached.data,
      cached: true,
    });
  }

  try {
    // 1. Fetch template metadata
    const metaRes = await fetchWithRetry(`https://marketplace.dify.ai/api/v1/templates/${id}`, {
      timeoutMs: 12000,
      retries: 2,
    });

    if (!metaRes.ok) {
      if (metaRes.status === 404) return notFound(`Dify template #${id} not found`);
      throw new Error(`Dify API responded with status ${metaRes.status}`);
    }

    const metaJson = await metaRes.json();
    const templateData = metaJson.data || metaJson;

    // 2. Fetch raw DSL YAML
    let rawDsl = "";
    let dslParsed: DifyWorkflowData = {};
    try {
      const dslRes = await fetchWithRetry(`https://marketplace.dify.ai/api/v1/templates/${id}`, {
        timeoutMs: 15000,
        retries: 2,
      });
      if (dslRes.ok) {
        rawDsl = await dslRes.text();
        dslParsed = parseDifyDslYaml(rawDsl);
      }
    } catch (dslErr) {
      logger.warn({ err: dslErr, workflowId: id }, "Dify DSL fetch warning");
    }

    // 3. Convert Dify workflow DSL to Agent Studio Graph
    const convertedGraph = convertDifyToAgentGraph(
      dslParsed.workflow
        ? dslParsed
        : {
            version: String(templateData.version || "1.0.0"),
            workflow: dslParsed.workflow || {
              graph: (dslParsed as Record<string, unknown>).graph as { nodes?: DifyNode[]; edges?: DifyEdge[] } | undefined,
            },
            app: dslParsed.app || {
              name: templateData.template_name || templateData.name,
              description: templateData.overview || templateData.description,
            },
            dependencies: dslParsed.dependencies,
          }
    );

    const convertedTemplate = convertDifyToWorkflowTemplate({
      ...templateData,
      dsl: dslParsed,
    });

    const plugins = Array.isArray(templateData.deps_plugins) ? templateData.deps_plugins : [];
    const pluginTags = plugins.map((p: string) => {
      const parts = p.split("/");
      return parts[parts.length - 1] || p;
    });

    const payload = {
      id: templateData.id,
      name: templateData.template_name || templateData.name || "Dify Workflow",
      description: templateData.overview || templateData.description || "",
      readme: templateData.readme || "",
      categories: Array.isArray(templateData.categories) ? templateData.categories : ["operations"],
      depsPlugins: plugins,
      pluginTags,
      preferredLanguages: templateData.preferred_languages || ["en"],
      icon: templateData.icon || null,
      iconBackground: templateData.icon_background || "#EFF1F5",
      iconFileKey: templateData.icon_file_key || null,
      author: templateData.publisher_unique_handle || (templateData.publisher_type === "organization" ? "Dify Team" : "Community"),
      publisherType: templateData.publisher_type || "individual",
      usageCount: typeof templateData.usage_count === "number" ? templateData.usage_count : 0,
      version: templateData.version || "1.0.0",
      badges: Array.isArray(templateData.badges) ? templateData.badges : [],
      createdAt: templateData.created_at,
      updatedAt: templateData.updated_at,
      source: "dify",
      url: `https://marketplace.dify.ai/templates/${id}`,
      rawDsl,
      convertedGraph,
      convertedTemplate,
      nodeCount: convertedGraph.nodes.length,
    };

    difyDetailCache.set(id, {
      data: payload,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: payload,
    });
  } catch (error: unknown) {
    logger.error({ err: error, workflowId: id }, "Dify template detail API error");
    const message = error instanceof Error ? error.message : `Failed to fetch Dify template #${id}`;
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 502 }
    );
  }
}
