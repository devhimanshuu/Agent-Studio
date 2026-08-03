import { describe, it, expect } from "vitest";
import {
  createLLMRouterFromConfig,
  countConfiguredModels,
  listConfiguredModels,
} from "@/modules/execution/llm/providerSelector";
import { GROQ_FREE_MODELS, OPENROUTER_FREE_MODELS } from "@/providers/llm";

describe("Provider selection (LLMProviderConfig)", () => {
  it("selects only Groq models when only the Groq key is set", () => {
    const router = createLLMRouterFromConfig({ groqApiKey: "gsk_test" });
    expect(router.isConfigured()).toBe(true);
    expect(countConfiguredModels({ groqApiKey: "gsk_test" })).toBe(GROQ_FREE_MODELS.length);
    expect(listConfiguredModels({ groqApiKey: "gsk_test" })).toEqual(GROQ_FREE_MODELS.map((m) => m.model));
  });

  it("selects only OpenRouter models when only the OpenRouter key is set", () => {
    const router = createLLMRouterFromConfig({ openRouterApiKey: "sk-or-v1-test" });
    expect(router.isConfigured()).toBe(true);
    expect(countConfiguredModels({ openRouterApiKey: "sk-or-v1-test" })).toBe(OPENROUTER_FREE_MODELS.length);
    expect(listConfiguredModels({ openRouterApiKey: "sk-or-v1-test" })).toEqual(OPENROUTER_FREE_MODELS.map((m) => m.model));
  });

  it("selects both vendors when both keys are set (Groq first)", () => {
    const router = createLLMRouterFromConfig({ groqApiKey: "gsk_test", openRouterApiKey: "sk-or-v1-test" });
    expect(router.isConfigured()).toBe(true);
    const models = listConfiguredModels({ groqApiKey: "gsk_test", openRouterApiKey: "sk-or-v1-test" });
    expect(models[0]).toBe(GROQ_FREE_MODELS[0].model); // best Groq model first
    expect(models[GROQ_FREE_MODELS.length]).toBe(OPENROUTER_FREE_MODELS[0].model); // then best OpenRouter model
  });

  it("produces an unconfigured (empty) router when no keys are set", () => {
    const router = createLLMRouterFromConfig({});
    expect(router.isConfigured()).toBe(false);
    expect(countConfiguredModels({})).toBe(0);
    expect(listConfiguredModels({})).toEqual([]);
  });

  it("throws a clear configuration error when the empty router is used", async () => {
    const router = createLLMRouterFromConfig({});
    await expect(router.complete([{ role: "user", content: "hi" }])).rejects.toThrow(/No LLM providers configured/);
  });
});
