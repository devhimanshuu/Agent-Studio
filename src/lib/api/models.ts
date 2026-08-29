import { ModelEntry } from "@/providers/llm";

export interface GetModelsParams {
  provider?: "groq" | "openrouter" | "openai" | "all" | string;
  category?: "general" | "reasoning" | "code" | "vision" | "embedding" | "safety" | "audio" | "router" | "all" | string;
  refresh?: boolean;
}

export interface ModelsApiResponse {
  success: boolean;
  totalCount: number;
  groqCount: number;
  openRouterCount: number;
  openaiCount?: number;
  liveFetched?: boolean;
  models: ModelEntry[];
  allModels: ModelEntry[];
  categories: Record<string, ModelEntry[]>;
  byProvider: Record<string, ModelEntry[]>;
  error?: string;
}

export interface TestModelParams {
  model: string;
  apiKey?: string;
  apiBaseUrl?: string;
  provider?: string;
}

export interface TestModelResponse {
  success: boolean;
  connected: boolean;
  latencyMs?: number;
  model?: string;
  provider?: string;
  reply?: string;
  error?: string;
}

export const modelsApi = {
  async getModels(params?: GetModelsParams): Promise<ModelsApiResponse> {
    const searchParams = new URLSearchParams();
    if (params?.provider) searchParams.set("provider", params.provider);
    if (params?.category) searchParams.set("category", params.category);
    if (params?.refresh) searchParams.set("refresh", "true");

    const qs = searchParams.toString();
    const url = `/api/models${qs ? `?${qs}` : ""}`;

    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Failed to fetch models (${res.status})`);
    }
    return json;
  },

  async testModel(params: TestModelParams): Promise<TestModelResponse> {
    const res = await fetch("/api/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.json();
  },
};
