import { describe, it, expect } from "vitest";
import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation } from "@/modules/execution/graph/agentAnnotation";
import { createInitialAgentState, ToolCallRecord } from "@/modules/execution/state/agentState";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";

function makeSkill(): SkillDTO {
  return {
    id: "s1",
    userId: "u1",
    name: "S",
    purpose: "P",
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeVersion(): SkillVersionDTO {
  return {
    id: "v1",
    skillId: "s1",
    versionNumber: 1,
    status: "DRAFT",
    inputSchema: {},
    outputSchema: {},
    instructions: "i",
    examples: [],
    allowedTools: [],
    actionsRequiringApproval: [],
    maxExecutionSteps: 10,
    createdAt: new Date(),
  };
}

const record = (n: number): ToolCallRecord => ({
  stepNumber: n,
  toolName: "calculator",
  action: "add",
  input: { a: n },
  status: "SUCCESS",
  requiresApproval: false,
});

describe("Agent state graph channels", () => {
  it("appends tool calls and merges results across sequential nodes", async () => {
    const nodeA = async () => ({ toolCalls: [record(1)], results: { step_1: 1 } });
    const nodeB = async () => ({ toolCalls: [record(2)], results: { step_2: 2 } });

    const graph = new StateGraph(AgentStateAnnotation)
      .addNode("a", nodeA)
      .addNode("b", nodeB)
      .addEdge(START, "a")
      .addEdge("a", "b")
      .addEdge("b", END)
      .compile();

    const initialState = createInitialAgentState({
      executionId: "exec-state-1",
      skill: makeSkill(),
      version: makeVersion(),
      userInput: {},
    });

    const out = await graph.invoke(initialState);
    expect(out.toolCalls).toHaveLength(2);
    expect(out.toolCalls.map((t) => t.stepNumber)).toEqual([1, 2]);
    // Later node results must not clobber earlier ones (merge reducer).
    expect(out.results).toEqual({ step_1: 1, step_2: 2 });
  });

  it("appends errors across nodes without overwriting", async () => {
    const nodeA = async () => ({ errors: ["first"] });
    const nodeB = async () => ({ errors: ["second"] });

    const graph = new StateGraph(AgentStateAnnotation)
      .addNode("a", nodeA)
      .addNode("b", nodeB)
      .addEdge(START, "a")
      .addEdge("a", "b")
      .addEdge("b", END)
      .compile();

    const initialState = createInitialAgentState({
      executionId: "exec-state-2",
      skill: makeSkill(),
      version: makeVersion(),
      userInput: {},
    });

    const out = await graph.invoke(initialState);
    expect(out.errors).toEqual(["first", "second"]);
  });
});
