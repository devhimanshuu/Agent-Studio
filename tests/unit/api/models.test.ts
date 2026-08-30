import { describe, it, expect } from "vitest";
import { getLiveProviderModels } from "@/providers/llm/modelProviderService";
import { GROQ_ALL_MODELS, OPENROUTER_CHAT_MODELS } from "@/providers/llm/modelLists";

describe("Model Provider Service & Pricing", () => {
  it("provides fallback models catalog for Groq and OpenRouter when APIs are unconfigured", async () => {
    const result = await getLiveProviderModels(true);
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.groqCount).toBeGreaterThan(0);
    expect(result.openRouterCount).toBeGreaterThan(0);
    expect(result.byProvider.groq.length).toBeGreaterThan(0);
    expect(result.byProvider.openrouter.length).toBeGreaterThan(0);
  });

  it("contains valid pricing fields on model definitions", () => {
    const openRouterModels = OPENROUTER_CHAT_MODELS;
    expect(openRouterModels.length).toBeGreaterThan(0);

    for (const model of openRouterModels) {
      expect(model.provider).toBe("openrouter");
      expect(typeof model.model).toBe("string");
      expect(typeof model.label).toBe("string");
      if (model.inputPrice !== undefined) {
        expect(typeof model.inputPrice).toBe("number");
      }
      if (model.outputPrice !== undefined) {
        expect(typeof model.outputPrice).toBe("number");
      }
    }
  });

  it("verifies Groq model roster contains proper categories and context windows", () => {
    const groqModels = GROQ_ALL_MODELS;
    expect(groqModels.length).toBeGreaterThan(5);

    const llama33 = groqModels.find((m) => m.model === "llama-3.3-70b-versatile");
    expect(llama33).toBeDefined();
    expect(llama33?.provider).toBe("groq");
    expect(llama33?.contextLength).toBe(131072);
  });
});
