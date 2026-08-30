import { LLMProvider, LLMError, LLMChatMessage } from "@/providers/llm";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { logger } from "@/lib/logger";
import { ExecutionPlan } from "../state/agentState";
import { executionPlanSchema } from "./planSchema";
import { withRetries } from "../executor/retry";

interface PlanInput {
  skill: SkillDTO;
  version: SkillVersionDTO;
  userInput: Record<string, unknown>;
  availableTools?: Array<{ name: string; description?: string; category?: string }>;
}

interface PlannerServiceOptions {
  /** Total planner attempts including the first (LLM transient failures retried). */
  maxRetries?: number;
  /** Per-attempt LLM request timeout in ms. */
  timeoutMs?: number;
  /** Cap on output tokens for the plan JSON. Default 2000. */
  maxTokens?: number;
}

/**
 * The planner turns a skill + user input into a deterministic ExecutionPlan.
 *
 * The LLM is deliberately a DEPENDENCY here, not the orchestrator: the planner
 * node is just one step in the LangGraph — if the LLM fails (after retries and
 * provider failover), the graph fails deterministically like any other node.
 */
export class PlannerService {
  private lastUsed: string | null = null;

  constructor(
    private llm: LLMProvider,
    private options: PlannerServiceOptions = {}
  ) {}

  /** The provider/model that last served a plan, e.g. `groq/llama-3.3-70b-versatile`. */
  get providerLabel(): string | null {
    return this.lastUsed;
  }

  async plan(input: PlanInput): Promise<ExecutionPlan> {
    const messages = buildPlannerMessages(input);

    const plan = await withRetries(
      () =>
        this.llm.structuredOutput(messages, executionPlanSchema, {
          temperature: 0,
          // Always cap the plan JSON so a runaway model reply can't blow past
          // the context window or inflate cost — previously the cap was
          // silently dropped whenever a timeoutMs was configured.
          maxTokens: this.options.maxTokens ?? 2000,
          ...(this.options.timeoutMs !== undefined && { timeoutMs: this.options.timeoutMs }),
        }),
      {
        attempts: this.options.maxRetries ?? 2,
        isRetryable: (error) => error instanceof LLMError && error.retryable,
        onRetry: (attempt, error) =>
          logger.warn(
            { attempt, error: error instanceof Error ? error.message : "unknown" },
            "Planner transient failure — retrying"
          ),
      }
    );

    this.lastUsed = this.captureProviderUsed(this.llm);
    // `.default(false)` fills requiresApproval at parse time — normalize so the
    // runtime sees a non-optional boolean on every step. stepNumbers are
    // RENUMBERED 1..n: the schema can't force an LLM to emit sequential
    // numbers, and resume logic keys approvals/results off `step_N` assuming
    // they are.
    return {
      ...plan,
      steps: plan.steps.map((step, index) => ({
        ...step,
        stepNumber: index + 1,
        requiresApproval: step.requiresApproval ?? false,
      })),
    };
  }

  private captureProviderUsed(llm: LLMProvider): string | null {
    // The router exposes the exact provider/model that served the call.
    const router = llm as LLMProvider & { lastUsed?: string | null };
    if (typeof router.lastUsed === "string" && router.lastUsed) return router.lastUsed;
    return `${llm.name}/${llm.model}`;
  }
}

function buildPlannerMessages({ skill, version, userInput, availableTools }: PlanInput): LLMChatMessage[] {
  const toolList = availableTools && availableTools.length > 0
    ? availableTools.map((t) => `${t.name}${t.description ? `: ${t.description}` : ""}`).join("\n- ")
    : "No external execution tools registered. Use \"none\" for all steps.";

  const system: LLMChatMessage = {
    role: "system",
    content: [
      "You are the PLANNING module of a deterministic AI agent runtime.",
      "You produce an execution plan for a skill. The plan is later executed step-by-step by the runtime; you do NOT execute anything yourself.",
      "Constraints:",
      "- Tool Selection: If a step requires an external tool, its toolName MUST be chosen strictly from the registered availableTools list below.",
      "- If a step is an AI reasoning, design, code generation, text writing, analysis, or general instruction step where no external tool is needed, set toolName to \"none\".",
      "- NEVER invent, hallucinate, or use placeholder tool names (such as 'smithery-cli', 'execute_command', 'connect', 'anthropic_tool', etc.). If instructions or descriptions mention external tools that are not in availableTools, set toolName to \"none\" or map to an available tool.",
      "- Mark a step requiresApproval=true when its action is in actionsRequiringApproval.",
      "- Do not exceed maxExecutionSteps total steps.",
      "- steps must be ordered by stepNumber starting at 1.",
      "",
      "Registered availableTools:",
      `- ${toolList}`,
    ].join("\n"),
  };

  const user: LLMChatMessage = {
    role: "user",
    content: JSON.stringify(
      {
        skillName: skill.name,
        purpose: skill.purpose,
        instructions: version.instructions,
        inputSchema: version.inputSchema,
        outputSchema: version.outputSchema,
        examples: version.examples,
        allowedTools: version.allowedTools,
        availableTools: availableTools ?? version.allowedTools,
        actionsRequiringApproval: version.actionsRequiringApproval,
        maxExecutionSteps: version.maxExecutionSteps,
        userInput,
        outputShape: {
          reasoning: "string — why this plan",
          requiredTools: ["string[] — tools this plan needs, or empty array if all steps use \"none\""],
          steps: [
            {
              stepNumber: "number, from 1",
              toolName: "string — one of availableTools, or \"none\"",
              action: "string — the specific action to invoke",
              input: "object — arguments or prompt context for the step",
              requiresApproval: "boolean",
            },
          ],
          expectedOutput: "string — the final answer shape",
        },
      },
      null,
      2
    ),
  };

  return [system, user];
}
