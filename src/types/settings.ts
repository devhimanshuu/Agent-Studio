export interface ModelRosterItem {
  label: string;
  model: string;
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
    groq: (string | ModelRosterItem)[];
    openRouter: (string | ModelRosterItem)[];
  };
  availableModels: {
    groq: ModelRosterItem[];
    openRouter: ModelRosterItem[];
  };
}
