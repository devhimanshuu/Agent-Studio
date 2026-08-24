export interface ModelRosterItem {
  label: string;
  model: string;
  category?: "code" | "general" | "reasoning" | "vision" | "embedding" | "safety" | "audio" | "router";
  contextLength?: number;
  latency?: string;
  throughput?: string;
  inputPrice?: number;
  outputPrice?: number;
}

export interface ProviderStatus {
  groqConfigured: boolean;
  openRouterConfigured: boolean;
  groqModels: number;
  openRouterModels: number;
  totalModels: number;
  /** Whether any provider is available to the execution runtime. */
  runtimeReady: boolean;
  /** Complete roster for the settings UI. */
  roster: {
    groq: ModelRosterItem[];
    openRouter: ModelRosterItem[];
  };
  availableModels: {
    groq: ModelRosterItem[];
    openRouter: ModelRosterItem[];
  };
}
