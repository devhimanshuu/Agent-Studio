"use client";

import { useQuery } from "@tanstack/react-query";
import { modelsApi, GetModelsParams, ModelsApiResponse } from "@/lib/api/models";
import { ModelEntry } from "@/providers/llm";

export function useModels(params?: GetModelsParams) {
  const query = useQuery<ModelsApiResponse>({
    queryKey: ["modelsCatalog", params?.provider, params?.category],
    queryFn: () => modelsApi.getModels(params),
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    gcTime: 15 * 60 * 1000,
    retry: 2,
  });

  const models: ModelEntry[] = query.data?.models || [];
  const allModels: ModelEntry[] = query.data?.allModels || models;
  const categories: Record<string, ModelEntry[]> = query.data?.categories || {};
  const byProvider: Record<string, ModelEntry[]> = query.data?.byProvider || {};

  const groqModels: ModelEntry[] = byProvider.groq || models.filter((m) => m.provider === "groq");
  const openRouterModels: ModelEntry[] = byProvider.openrouter || models.filter((m) => m.provider === "openrouter");
  const openaiModels: ModelEntry[] = byProvider.openai || models.filter((m) => m.provider === "openai");

  return {
    ...query,
    models,
    allModels,
    categories,
    byProvider,
    groqModels,
    openRouterModels,
    openaiModels,
    totalCount: query.data?.totalCount ?? models.length,
    liveFetched: query.data?.liveFetched ?? false,
  };
}
