export interface ProviderStatus {
  groqConfigured: boolean;
  openRouterConfigured: boolean;
  groqModels: number;
  openRouterModels: number;
  totalModels: number;
  /** Whether any provider is available to the execution runtime. */
  runtimeReady: boolean;
  /** Example roster (labels only, no secrets) for the settings UI. */
  roster: {
    groq: string[];
    openRouter: string[];
  };
}
