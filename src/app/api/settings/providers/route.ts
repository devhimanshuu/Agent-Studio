import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/config/env";
import { unauthorized } from "@/lib/api/handlers";
import {
  GROQ_FREE_MODELS,
  OPENROUTER_FREE_MODELS,
  ALL_FALLBACK_MODELS,
  ModelEntry,
} from "@/providers/llm";
import { ProviderStatus } from "@/types/settings";

/**
 * LLM provider status for the Settings page.
 *
 * SECURITY: only booleans + model counts/labels are returned. API keys live in
 * server-side env and never leave the server. The execution runtime reads the
 * same env directly — this endpoint is purely informational.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const hasGroq = Boolean(env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY);

  const roster = (entries: ModelEntry[]) => entries.map((e) => e.label);

  const status: ProviderStatus = {
    groqConfigured: hasGroq,
    openRouterConfigured: hasOpenRouter,
    groqModels: hasGroq ? GROQ_FREE_MODELS.length : 0,
    openRouterModels: hasOpenRouter ? OPENROUTER_FREE_MODELS.length : 0,
    totalModels: hasGroq || hasOpenRouter ? ALL_FALLBACK_MODELS.length : 0,
    runtimeReady: hasGroq || hasOpenRouter,
    roster: {
      groq: hasGroq ? roster(GROQ_FREE_MODELS) : [],
      openRouter: hasOpenRouter ? roster(OPENROUTER_FREE_MODELS) : [],
    },
  };

  return NextResponse.json({ success: true, data: status });
}
