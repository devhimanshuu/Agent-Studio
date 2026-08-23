import { NextResponse } from "next/server";
import {
  ALL_FALLBACK_MODELS,
  GROQ_FREE_MODELS,
  OPENROUTER_FREE_MODELS,
  getFreeModelsByCategory,
} from "@/providers/llm";

/**
 * GET /api/models
 * Returns the catalog of free LLM models available on Groq and OpenRouter.
 */
export async function GET() {
  const byCategory = getFreeModelsByCategory();

  return NextResponse.json({
    success: true,
    totalCount: ALL_FALLBACK_MODELS.length,
    groqCount: GROQ_FREE_MODELS.length,
    openRouterCount: OPENROUTER_FREE_MODELS.length,
    models: ALL_FALLBACK_MODELS,
    categories: byCategory,
  });
}
