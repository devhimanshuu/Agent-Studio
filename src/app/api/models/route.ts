import { NextRequest, NextResponse } from "next/server";
import { getLiveProviderModels } from "@/providers/llm";
import { logger } from "@/lib/logger";

/**
 * GET /api/models
 * Returns the dynamic list of LLM models fetched directly from providers (Groq, OpenRouter, OpenAI).
 * Supports query params: ?provider=groq|openrouter|openai|all & ?category=general|reasoning|code|... & ?refresh=true
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const providerFilter = searchParams.get("provider")?.toLowerCase();
    const categoryFilter = searchParams.get("category")?.toLowerCase();
    const forceRefresh = searchParams.get("refresh") === "true";

    const data = await getLiveProviderModels(forceRefresh);

    let filteredModels = data.models;

    if (providerFilter && providerFilter !== "all") {
      filteredModels = filteredModels.filter((m) => m.provider.toLowerCase() === providerFilter);
    }

    if (categoryFilter && categoryFilter !== "all") {
      filteredModels = filteredModels.filter((m) => (m.category || "general").toLowerCase() === categoryFilter);
    }

    return NextResponse.json({
      success: true,
      totalCount: data.totalCount,
      groqCount: data.groqCount,
      openRouterCount: data.openRouterCount,
      openaiCount: data.openaiCount,
      liveFetched: data.liveFetched,
      models: filteredModels,
      allModels: data.models,
      categories: data.byCategory,
      byProvider: data.byProvider,
    });
  } catch (error) {
    logger.error({ err: error }, "Models API error");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch provider models",
      },
      { status: 500 }
    );
  }
}

