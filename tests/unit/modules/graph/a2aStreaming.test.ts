import { describe, it, expect } from "vitest";
import { GraphInterpreter } from "@/modules/graph/graphInterpreter";
import { AgentGraphDefinition } from "@/types/graph";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { createToolRegistry } from "@/modules/tools";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { executionEventBus, ExecutionEvent } from "@/modules/graph/eventBus";
import { FakeExecutionRepo } from "../helpers/fakeExecutionRepo";
import { FakeApprovalRepo } from "../helpers/fakeApprovalRepo";
import { FakeLogRepo } from "../helpers/fakeLogRepo";
import { StubLLM } from "../helpers/stubLLM";

class StreamingStubLLM extends StubLLM {
  override async stream() {
    async function* gen() {
      yield { type: "content" as const, content: "Streaming token 1. " };
      yield { type: "content" as const, content: "Streaming token 2." };
      yield { type: "done" as const };
    }
    return gen();
  }
}

function makeSkill(): SkillDTO {
  return {
    id: "s1",
    userId: "u1",
    name: "A2A Skill",
    purpose: "test",
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
    instructions: "a2a graph test",
    examples: [],
    allowedTools: [],
    actionsRequiringApproval: [],
    maxExecutionSteps: 40,
    createdAt: new Date(),
  };
}

describe("A2A Protocol & Token Streaming in Graph Interpreter", () => {
  it("streams LLM token chunks and emits node:token_chunk events", async () => {
    const executionRepo = new FakeExecutionRepo();
    const approvalRepo = new FakeApprovalRepo();
    const logRepo = new FakeLogRepo();
    const llm = new StreamingStubLLM({});

    const interpreter = new GraphInterpreter({
      llm,
      toolRegistry: createToolRegistry(),
      permissionChecker: new PermissionChecker(),
      executionRepo,
      approvalRepo,
      logRepo,
    });

    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        {
          id: "agent1",
          type: "agent",
          position: { x: 100, y: 0 },
          data: { label: "RESEARCH AGENT", prompt: "Conduct research." },
        },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "agent1", label: "" },
        { id: "e2", source: "agent1", target: "end", label: "" },
      ],
    };

    const receivedEvents: ExecutionEvent[] = [];
    const unsub = executionEventBus.subscribe("exec-stream-1", (evt) => {
      receivedEvents.push(evt);
    });

    const result = await interpreter.run({
      executionId: "exec-stream-1",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: { query: "Quantum computing" },
    });

    unsub();

    expect(result.status).toBe("COMPLETED");
    const tokenEvents = receivedEvents.filter((e) => e.type === "node:token_chunk");
    expect(tokenEvents.length).toBeGreaterThan(0);
  });

  it("executes A2A Delegate node and emits a2a:task:delegated lifecycle events", async () => {
    const executionRepo = new FakeExecutionRepo();
    const approvalRepo = new FakeApprovalRepo();
    const logRepo = new FakeLogRepo();
    const llm = new StubLLM({});

    const interpreter = new GraphInterpreter({
      llm,
      toolRegistry: createToolRegistry(),
      permissionChecker: new PermissionChecker(),
      executionRepo,
      approvalRepo,
      logRepo,
    });

    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        {
          id: "a2a_remote",
          type: "a2a_delegate",
          position: { x: 100, y: 0 },
          data: {
            label: "REMOTE GEMINI",
            a2aAgentUrl: "https://a2a.agents.google.dev/v1/gemini-researcher/tasks",
            a2aCapability: "deep_research",
          },
        },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "a2a_remote", label: "" },
        { id: "e2", source: "a2a_remote", target: "end", label: "" },
      ],
    };

    const receivedEvents: ExecutionEvent[] = [];
    const unsub = executionEventBus.subscribe("exec-a2a-1", (evt) => {
      receivedEvents.push(evt);
    });

    const result = await interpreter.run({
      executionId: "exec-a2a-1",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: { topic: "AI Safety" },
    });

    unsub();

    expect(result.status).toBe("COMPLETED");
    const a2aEvents = receivedEvents.filter((e) => e.type === "a2a:task:delegated");
    expect(a2aEvents.length).toBeGreaterThan(0);
  });

  it("executes A2A Channel node and emits a2a:message:exchange events", async () => {
    const executionRepo = new FakeExecutionRepo();
    const approvalRepo = new FakeApprovalRepo();
    const logRepo = new FakeLogRepo();
    const llm = new StubLLM({});

    const interpreter = new GraphInterpreter({
      llm,
      toolRegistry: createToolRegistry(),
      permissionChecker: new PermissionChecker(),
      executionRepo,
      approvalRepo,
      logRepo,
    });

    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        {
          id: "channel1",
          type: "a2a_channel",
          position: { x: 100, y: 0 },
          data: {
            label: "SWARM CHANNEL",
            a2aChannelMode: "debate",
            a2aMaxTurns: 1,
            a2aParticipants: [
              { name: "Agent Alpha", agentUrl: "a2a://alpha", role: "proposer" },
              { name: "Agent Beta", agentUrl: "a2a://beta", role: "critic" },
            ],
          },
        },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "channel1", label: "" },
        { id: "e2", source: "channel1", target: "end", label: "" },
      ],
    };

    const receivedEvents: ExecutionEvent[] = [];
    const unsub = executionEventBus.subscribe("exec-channel-1", (evt) => {
      receivedEvents.push(evt);
    });

    const result = await interpreter.run({
      executionId: "exec-channel-1",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: {},
    });

    unsub();

    expect(result.status).toBe("COMPLETED");
    const exchangeEvents = receivedEvents.filter((e) => e.type === "a2a:message:exchange");
    expect(exchangeEvents.length).toBe(2);
  });
});
