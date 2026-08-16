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

/** LLM stub whose `complete` blocks for a fixed delay — used to test the timeout. */
class SlowStubLLM extends StubLLM {
  constructor(private delayMs: number) {
    super({});
  }
  override async complete() {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return { content: "ok", finishReason: "stop" as const };
  }
}

function makeSkill(): SkillDTO {
  return {
    id: "s1",
    userId: "u1",
    name: "Graph skill",
    purpose: "test",
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
    inputSchema: {},
    outputSchema: {},
    instructions: "graph",
    examples: [],
    allowedTools: ["calculator", "ai_classification"],
    actionsRequiringApproval: [],
    maxExecutionSteps: 40,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeInterpreter() {
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
  return { interpreter, executionRepo, approvalRepo, logRepo, llm };
}

function linearGraph(): AgentGraphDefinition {
  return {
    version: 1,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
      {
        id: "calc",
        type: "tool",
        position: { x: 0, y: 0 },
        data: { label: "CALC", toolName: "calculator", action: "add", inputTemplate: { a: "{{ input.x }}", b: 2 } },
      },
      { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
    ],
    edges: [
      { id: "e1", source: "start", target: "calc" },
      { id: "e2", source: "calc", target: "end" },
    ],
  };
}

describe("GraphInterpreter", () => {
  it("executes a linear graph with a tool node and assembles final output", async () => {
    const { interpreter, executionRepo, logRepo } = makeInterpreter();
    const result = await interpreter.run({
      executionId: "g-exec-1",
      skill: makeSkill(),
      version: makeVersion(),
      graph: linearGraph(),
      userInput: { x: 5 },
    });

    expect(result.status).toBe("COMPLETED");
    const results = result.finalOutput?.results as Record<string, unknown> | undefined;
    expect(results).toMatchObject({
      calc: { action: "add", result: 7 },
    });
    expect(logRepo.logs.some((l) => l.event === "GRAPH_EXECUTION_FINISHED")).toBe(true);
    expect(executionRepo.steps.length).toBeGreaterThan(0);
    expect(executionRepo.toolCalls).toHaveLength(1);
  });

  it("routes via a deterministic router condition", async () => {
    const { interpreter } = makeInterpreter();
    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        {
          id: "classifier",
          type: "tool",
          position: { x: 0, y: 0 },
          data: {
            label: "CLASS",
            toolName: "ai_classification",
            action: "classify_risk",
            inputTemplate: { input: "{{ input.text }}", categories: ["URGENT", "STANDARD"] },
          },
        },
        {
          id: "router",
          type: "router",
          position: { x: 0, y: 0 },
          data: { label: "ROUTER", routerMode: "deterministic", condition: 'results.classifier.assignedCategory == "URGENT"' },
        },
        { id: "escalate", type: "agent", position: { x: 0, y: 0 }, data: { label: "ESCALATE", prompt: "Escalate this ticket urgently." } },
        { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "classifier" },
        { id: "e2", source: "classifier", target: "router" },
        { id: "e3", source: "router", target: "escalate", label: "true" },
        { id: "e4", source: "router", target: "end", label: "false" },
      ],
    };

    const result = await interpreter.run({
      executionId: "g-exec-2",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: { text: "URGENT: unauthorized access detected — respond immediately" },
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.finalOutput?.results).toHaveProperty("escalate");
  });

  it("enforces the loop counter and exits after maxIterations", async () => {
    const { interpreter } = makeInterpreter();
    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        { id: "loop", type: "loop", position: { x: 0, y: 0 }, data: { label: "LOOP", maxIterations: 3 } },
        {
          id: "worker",
          type: "tool",
          position: { x: 0, y: 0 },
          data: { label: "WORKER", toolName: "calculator", action: "add", inputTemplate: { a: 1, b: 1 } },
        },
        { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "loop" },
        { id: "e2", source: "loop", target: "worker", label: "body" },
        { id: "e3", source: "worker", target: "loop" },
        { id: "e4", source: "loop", target: "end", label: "exit" },
      ],
    };

    const result = await interpreter.run({
      executionId: "g-exec-3",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: {},
    });

    expect(result.status).toBe("COMPLETED");
    const results = result.finalOutput?.results as Record<string, unknown> | undefined;
    // 3 iterations of the worker tool + exit
    expect(results?.loop).toMatchObject({ iteration: 4, exited: true });
  });

  it("pauses at an approval node and creates a HITL request", async () => {
    const { interpreter, approvalRepo, executionRepo } = makeInterpreter();
    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        {
          id: "gate",
          type: "approval",
          position: { x: 0, y: 0 },
          data: { label: "APPROVAL", approvalReason: "Review this disbursement" },
        },
        {
          id: "dispatch",
          type: "tool",
          position: { x: 0, y: 0 },
          data: { label: "DISPATCH", toolName: "calculator", action: "add", inputTemplate: { a: 1, b: 1 } },
        },
        { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "gate" },
        { id: "e2", source: "gate", target: "dispatch" },
        { id: "e3", source: "dispatch", target: "end" },
      ],
    };

    const result = await interpreter.run({
      executionId: "g-exec-4",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: {},
    });

    expect(result.status).toBe("PAUSED_FOR_APPROVAL");
    expect(approvalRepo.requests).toHaveLength(1);
    expect(approvalRepo.requests[0].status).toBe("PENDING");
    expect(executionRepo.statusUpdates.some((u) => u.status === "PAUSED_FOR_APPROVAL")).toBe(true);
  });

  it("executes a map-reduce parallel node over input items", async () => {
    const { interpreter } = makeInterpreter();
    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        {
          id: "parallel",
          type: "parallel",
          position: { x: 0, y: 0 },
          data: { label: "MAP", parallelMode: "map", mapField: "input.items" },
        },
        {
          id: "worker",
          type: "tool",
          position: { x: 0, y: 0 },
          data: { label: "WORKER", toolName: "calculator", action: "add", inputTemplate: { a: "{{ item }}", b: 10 } },
        },
        { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "parallel" },
        { id: "e2", source: "parallel", target: "worker", label: "worker" },
        { id: "e3", source: "parallel", target: "end", label: "join" },
      ],
    };

    const result = await interpreter.run({
      executionId: "g-exec-5",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: { items: [1, 2, 3] },
    });

    expect(result.status).toBe("COMPLETED");
    const results = result.finalOutput?.results as Record<string, unknown> | undefined;
    const parallel = results?.parallel as { outputs: unknown[] } | undefined;
    expect(parallel?.outputs).toHaveLength(3);
    expect(parallel?.outputs.map((o) => (o as { result: number }).result)).toEqual([11, 12, 13]);
  });

  it("resumes past an approved node without re-pausing", async () => {
    const { interpreter, approvalRepo } = makeInterpreter();
    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        { id: "gate", type: "approval", position: { x: 0, y: 0 }, data: { label: "APPROVAL" } },
        { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "gate" },
        { id: "e2", source: "gate", target: "end" },
      ],
    };
    const state = { results: {}, loopCounters: {}, visitCounts: {}, toolCalls: [], stepCounter: 2, providerUsed: null };

    const result = await interpreter.run({
      executionId: "g-exec-6",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: {},
      resume: { state, fromNodeId: "end" },
    });

    expect(result.status).toBe("COMPLETED");
    expect(approvalRepo.requests).toHaveLength(0);
  });

  it("fails with STEP_LIMIT_EXCEEDED on runaway cycles", async () => {
    const { interpreter } = makeInterpreter();
    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        { id: "a", type: "agent", position: { x: 0, y: 0 }, data: { label: "A", prompt: "p" } },
        { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "a" },
        { id: "e2", source: "a", target: "a" },
        { id: "e3", source: "a", target: "end" },
      ],
    };

    const result = await interpreter.run({
      executionId: "g-exec-7",
      skill: makeSkill(),
      version: makeVersion({ maxExecutionSteps: 5 }),
      graph,
      userInput: {},
    });

    expect(result.status).toBe("STEP_LIMIT_EXCEEDED");
  });

  it("rejects unauthorized tool nodes via the permission checker", async () => {
    const { interpreter } = makeInterpreter();
    const graph = linearGraph();
    const result = await interpreter.run({
      executionId: "g-exec-8",
      skill: makeSkill(),
      version: makeVersion({ allowedTools: [] }),
      graph,
      userInput: { x: 5 },
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/TOOL_NOT_ALLOWED/i);
  });

  it("emits node events for START and edge:traverse events for every transition", async () => {
    const { interpreter } = makeInterpreter();
    const events: ExecutionEvent[] = [];
    const unsubscribe = executionEventBus.subscribe("g-exec-9", (e) => events.push(e));
    try {
      await interpreter.run({
        executionId: "g-exec-9",
        skill: makeSkill(),
        version: makeVersion(),
        graph: linearGraph(),
        userInput: { x: 5 },
      });
    } finally {
      unsubscribe();
    }

    // START node participates in the trace (previously silent).
    expect(events.some((e) => e.type === "node:start" && e.nodeId === "start")).toBe(true);
    expect(events.some((e) => e.type === "node:end" && e.nodeId === "start")).toBe(true);

    // Every graph transition is published with the persisted edge id.
    const traversals = events.filter((e) => e.type === "edge:traverse");
    expect(traversals.map((e) => (e as { edgeId?: string }).edgeId).sort()).toEqual(["e1", "e2"]);
  });

  it("enforces the wall-clock timeout", async () => {
    const executionRepo = new FakeExecutionRepo();
    const approvalRepo = new FakeApprovalRepo();
    const logRepo = new FakeLogRepo();
    const slowLlm = new SlowStubLLM(40);
    const interpreter = new GraphInterpreter({
      llm: slowLlm,
      toolRegistry: createToolRegistry(),
      permissionChecker: new PermissionChecker(),
      executionRepo,
      approvalRepo,
      logRepo,
      timeoutMs: 20,
    });
    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        { id: "a", type: "agent", position: { x: 0, y: 0 }, data: { label: "A", prompt: "slow agent" } },
        { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "a" },
        { id: "e2", source: "a", target: "end" },
      ],
    };

    const result = await interpreter.run({
      executionId: "g-exec-10",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: {},
    });

    expect(result.status).toBe("STEP_LIMIT_EXCEEDED");
    expect(result.error).toMatch(/timed out/i);
  });

  it("rejects approval nodes inside parallel branches instead of corrupting the pause state", async () => {
    const { interpreter } = makeInterpreter();
    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        {
          id: "parallel",
          type: "parallel",
          position: { x: 0, y: 0 },
          data: { label: "MAP", parallelMode: "map", mapField: "input.items" },
        },
        { id: "gate", type: "approval", position: { x: 0, y: 0 }, data: { label: "GATE" } },
        { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "parallel" },
        { id: "e2", source: "parallel", target: "gate", label: "worker" },
        { id: "e3", source: "parallel", target: "end", label: "join" },
      ],
    };

    const result = await interpreter.run({
      executionId: "g-exec-11",
      skill: makeSkill(),
      version: makeVersion(),
      graph,
      userInput: { items: [1, 2] },
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/inside a parallel branch/i);
  });
});
