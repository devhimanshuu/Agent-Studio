import { describe, it, expect } from "vitest";
import {
  createLLMRouterFromConfig,
  countConfiguredModels,
  listConfiguredModels,
} from "@/modules/execution/llm/providerSelector";
import {
  GROQ_FREE_MODELS,
  OPENROUTER_FREE_MODELS,
  getCategoryFallbackModels,
  getFallbackChainForModel,
} from "@/providers/llm";

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

  it("resolves category fallback models for each capability", () => {
    const reasoningChain = getCategoryFallbackModels("reasoning");
    expect(reasoningChain.length).toBeGreaterThan(3);
    expect(reasoningChain[0].model).toBe("openai/gpt-oss-120b");

    const codeChain = getCategoryFallbackModels("code");
    expect(codeChain.length).toBeGreaterThan(2);
    expect(codeChain[0].model).toBe("qwen/qwen3.6-27b");

    const safetyChain = getCategoryFallbackModels("safety");
    expect(safetyChain.length).toBeGreaterThan(2);
    expect(safetyChain[0].model).toBe("meta-llama/llama-prompt-guard-2-86m");

    const audioChain = getCategoryFallbackModels("audio");
    expect(audioChain.length).toBeGreaterThan(2);
    expect(audioChain[0].model).toBe("whisper-large-v3-turbo");
  });

  it("constructs an ordered model fallback chain with chosen model first", () => {
    const chain = getFallbackChainForModel("cohere/north-mini-code:free");
    expect(chain[0].model).toBe("cohere/north-mini-code:free");
    expect(chain.length).toBeGreaterThan(1);
    // Other models in same code category follow
    expect(chain.some((m) => m.model === "qwen/qwen3.6-27b")).toBe(true);
  });
});
