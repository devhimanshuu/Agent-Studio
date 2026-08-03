import { describe, it, expect } from "vitest";
import { PlannerService } from "@/modules/execution/planner/plannerService";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { StubLLM } from "./helpers/stubLLM";
import { LLMProvider, LLMChatMessage, LLMCompletionOptions, LLMCompletionResult, LLMError } from "@/providers/llm";
import { requestStructuredOutput, extractJsonObject } from "@/providers/llm/structuredOutput";
import { z } from "zod";

function makeSkill(): SkillDTO {
  return {
    id: "s1",
    userId: "u1",
    name: "Test Skill",
    purpose: "A test skill",
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeVersion(overrides: Partial<SkillVersionDTO> = {}): SkillVersionDTO {
  return {
    id: "v1",
    skillId: "s1",
    versionNumber: 1,
    status: "DRAFT",
    inputSchema: { required: ["text"] },
    outputSchema: {},
    instructions: "Analyze the input text.",
    examples: [],
    allowedTools: ["calculator"],
    actionsRequiringApproval: [],
    maxExecutionSteps: 10,
    createdAt: new Date(),
    ...overrides,
  };
}

const samplePlan = {
  reasoning: "Use the calculator to add 1 and 2.",
  requiredTools: ["calculator"],
  steps: [{ stepNumber: 1, toolName: "calculator", action: "add", input: { a: 1, b: 2 } }],
  expectedOutput: "3",
};

describe("PlannerService", () => {
  it("returns a plan and fills the requiresApproval flag on every step", async () => {
    const llm = new StubLLM({ plan: samplePlan });
    const planner = new PlannerService(llm);

    const plan = await planner.plan({ skill: makeSkill(), version: makeVersion(), userInput: { text: "hi" } });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].requiresApproval).toBe(false);
    expect(plan.requiredTools).toEqual(["calculator"]);
  });

  it("retries a transient LLM failure and succeeds", async () => {
    const llm = new StubLLM({
      plan: samplePlan,
      failNTimes: 1,
      error: new LLMError("rate limited", { provider: "stub", model: "m", status: 429 }),
    });
    const planner = new PlannerService(llm, { maxRetries: 3 });

    const plan = await planner.plan({ skill: makeSkill(), version: makeVersion(), userInput: {} });
    expect(plan.steps).toHaveLength(1);
    expect(llm.calls.filter((c) => c.method === "structuredOutput")).toHaveLength(2);
  });

  it("exposes which provider/model served the plan", async () => {
    const llm = new StubLLM({ plan: samplePlan, providerLabel: "groq/llama-3.3-70b-versatile" });
    const planner = new PlannerService(llm);
    await planner.plan({ skill: makeSkill(), version: makeVersion(), userInput: {} });
    expect(planner.providerLabel).toBe("groq/llama-3.3-70b-versatile");
  });

  it("propagates a non-retryable provider error", async () => {
    const llm = new StubLLM({ error: new Error("fatal") });
    const planner = new PlannerService(llm, { maxRetries: 3 });
    await expect(planner.plan({ skill: makeSkill(), version: makeVersion(), userInput: {} })).rejects.toThrow("fatal");
  });

  it("always sends a maxTokens cap and forwards timeoutMs to the LLM", async () => {
    const llm = new StubLLM({ plan: samplePlan });
    // Regression: maxTokens used to be dropped whenever timeoutMs was set.
    const planner = new PlannerService(llm, { timeoutMs: 5000 });
    await planner.plan({ skill: makeSkill(), version: makeVersion(), userInput: {} });

    const call = llm.calls.find((c) => c.method === "structuredOutput");
    expect(call?.options?.maxTokens).toBe(2000);
    expect(call?.options?.timeoutMs).toBe(5000);
  });
});

describe("requestStructuredOutput", () => {
  const stubProvider: LLMProvider = {
    name: "stub",
    model: "m",
    isConfigured: () => true,
    complete: async (messages: LLMChatMessage[], _options?: LLMCompletionOptions): Promise<LLMCompletionResult> => {
      const user = messages[messages.length - 1];
      const parsed = JSON.parse(user.content);
      return {
        content: `Sure! Here is the JSON:\n${JSON.stringify({ ok: parsed.ask, nested: { value: 42 } })}\n\nHope that helps!`,
        finishReason: "stop",
      };
    },
    generate: async (m: LLMChatMessage[], o?: LLMCompletionOptions) => stubProvider.complete(m, o),
    stream: async () => ({
      async *[Symbol.asyncIterator]() {
        yield { type: "content" as const, content: "x" };
        yield { type: "done" as const };
      },
    }),
    structuredOutput: async <T>(m: LLMChatMessage[], schema: z.ZodType<T>) => requestStructuredOutput(stubProvider, m, schema),
  };

  it("parses JSON out of a noisy model reply and validates it", async () => {
    const schema = z.object({ ok: z.string(), nested: z.object({ value: z.number() }) });
    const result = await stubProvider.structuredOutput(
      [{ role: "user", content: JSON.stringify({ ask: "yes" }) }],
      schema
    );
    expect(result.ok).toBe("yes");
    expect(result.nested.value).toBe(42);
  });

  it("extracts the first JSON object from arbitrary text", () => {
    expect(extractJsonObject('prefix {"a": 1} suffix')).toEqual({ a: 1 });
  });
});
