import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/config/env";
import { unauthorized } from "@/lib/api/handlers";
import { getLiveProviderModels, ModelEntry } from "@/providers/llm";
import { ProviderStatus } from "@/types/settings";

/**
 * LLM provider status for the Settings page.
 * Fetches dynamic live provider models from Groq and OpenRouter.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const hasGroq = Boolean(env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY);

  const formatModels = (entries: ModelEntry[]) =>
    entries.map((e) => ({
      label: e.label,
      model: e.model,
      category: e.category || "general",
      contextLength: e.contextLength,
      latency: e.latency,
      throughput: e.throughput,
      inputPrice: e.inputPrice ?? 0,
      outputPrice: e.outputPrice ?? 0,
    }));

  const liveData = await getLiveProviderModels();
  const groqCatalog = liveData.byProvider.groq || [];
  const openRouterCatalog = liveData.byProvider.openrouter || [];

  const status: ProviderStatus = {
    groqConfigured: hasGroq,
    openRouterConfigured: hasOpenRouter,
    groqModels: hasGroq ? groqCatalog.length : 0,
    openRouterModels: hasOpenRouter ? openRouterCatalog.length : 0,
    totalModels: hasGroq || hasOpenRouter ? (hasGroq ? groqCatalog.length : 0) + (hasOpenRouter ? openRouterCatalog.length : 0) : 0,
    runtimeReady: hasGroq || hasOpenRouter,
    roster: {
      groq: hasGroq ? formatModels(groqCatalog) : [],
      openRouter: hasOpenRouter ? formatModels(openRouterCatalog) : [],
    },
    availableModels: {
      groq: formatModels(groqCatalog),
      openRouter: formatModels(openRouterCatalog),
    },
  };

  return NextResponse.json({ success: true, data: status });
}
