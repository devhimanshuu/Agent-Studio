import { LLMProvider, LLMChatMessage, getLLMProvider } from "@/providers/llm";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { ExecutionStatus } from "@/types/execution";
import { AgentGraphDefinition, GraphNodeDefinition, GraphEdgeDefinition } from "@/types/graph";
import { ToolCallRecord } from "@/modules/execution/state/agentState";
import { IExecutionRepository } from "@/repositories/interfaces/IExecutionRepository";
import { IApprovalRepository } from "@/repositories/interfaces/IApprovalRepository";
import { IExecutionLogRepository } from "@/repositories/interfaces/IExecutionLogRepository";
import { ToolRegistry } from "@/modules/tools";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { StepLimitExceededError, ExecutionCancelledError, ExecutionError } from "@/modules/execution/executor/errors";
import { logger } from "@/lib/logger";
import { executionEventBus, GraphNodeStatus } from "./eventBus";
import { evaluateExpression, ExpressionError } from "./expression";

export interface GraphInterpreterDeps {
  llm?: LLMProvider;
  toolRegistry: ToolRegistry;
  permissionChecker: PermissionChecker;
  executionRepo: IExecutionRepository;
  approvalRepo: IApprovalRepository;
  logRepo: IExecutionLogRepository;
  /** Wall-clock limit for the whole graph run. Default 120s. */
  timeoutMs?: number;
}

/** Runtime state that must survive a HITL pause so the run resumes in place. */
export interface GraphState {
  results: Record<string, unknown>;
  loopCounters: Record<string, number>;
  visitCounts: Record<string, number>;
  toolCalls: ToolCallRecord[];
  stepCounter: number;
  providerUsed: string | null;
}

export interface GraphRunInput {
  executionId: string;
  skill: SkillDTO;
  version: SkillVersionDTO;
  graph: AgentGraphDefinition;
  userInput: Record<string, unknown>;
  signal?: AbortSignal;
  /** Continue a previously paused run from a node (skips the approved node). */
  resume?: {
    state: GraphState;
    /** Node to continue FROM (the successor of the approval node). */
    fromNodeId: string;
  };
}

export interface GraphRunResult {
  status: ExecutionStatus;
  finalOutput: Record<string, unknown> | null;
  providerUsed: string | null;
  error?: string;
}

interface WalkCtx {
  executionId: string;
  skill: SkillDTO;
  version: SkillVersionDTO;
  graph: AgentGraphDefinition;
  userInput: Record<string, unknown>;
  signal?: AbortSignal;
  llm: LLMProvider;
  results: Record<string, unknown>;
  loopCounters: Record<string, number>;
  visitCounts: Record<string, number>;
  toolCalls: ToolCallRecord[];
  stepCounter: number;
  providerUsed: string | null;
  /** Epoch ms when the run (or resume) started — for the wall-clock timeout. */
  startedAt: number;
  /** Wall-clock budget for the whole run; 0 disables. */
  timeoutMs: number;
  /** Node id currently being iterated (map mode) — exposed as `item`. */
  item?: unknown;
  /** Map mode: path to the item that produced this sub-walk (for labels). */
  itemPath?: string;
}

const MAX_NODE_VISITS = 200;

/** Default wall-clock budget for a graph run (see GraphInterpreterDeps.timeoutMs). */
const DEFAULT_TIMEOUT_MS = 120_000;

/** Extract a JSON object from an LLM reply — tolerant of code fences / prose. */
function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1));
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Resolve `{{ input.x }}` / `{{ results.nodeId.path }}` / `{{ item.x }}`
 * templates in a value. A value that is a SINGLE template reference keeps the
 * resolved type (number / boolean / object) so tool inputs stay typed;
 * embedded references (prose + {{ x }}) interpolate as strings.
 */
function resolveTemplate(value: unknown, ctx: WalkCtx): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const singleRef = trimmed.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (singleRef) {
      const resolved = resolvePath(singleRef[1].trim(), ctx);
      return resolved === undefined ? "" : resolved;
    }
    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
      const resolved = resolvePath(expr.trim(), ctx);
      if (resolved === undefined) return "";
      return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolveTemplate(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveTemplate(v, ctx);
    }
    return out;
  }
  return value;
}

/** Resolve `input.x`, `results.nodeId.x`, `item.x` path expressions against the walk context. */
function resolvePath(path: string, ctx: WalkCtx): unknown {
  const parts = path.split(".");
  const root = parts.shift() ?? "";
  if (root === "input") return getByPath(ctx.userInput, parts);
  if (root === "item") return getByPath(ctx.item, parts);
  if (root === "results") {
    const nodeId = parts.shift() ?? "";
    return getByPath(ctx.results[nodeId], parts);
  }
  return undefined;
}

function getByPath(value: unknown, parts: string[]): unknown {
  let current = value;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export class GraphInterpreter {
  constructor(private deps: GraphInterpreterDeps) {}

  async run(input: GraphRunInput): Promise<GraphRunResult> {
    const startedAt = Date.now();
    const timeoutMs = this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const { executionId, skill, version, graph, userInput } = input;
    const llm = this.deps.llm ?? getLLMProvider();

    const ctx: WalkCtx = {
      executionId,
      skill,
      version,
      graph,
      userInput,
      signal: input.signal,
      llm,
      results: input.resume?.state.results ?? {},
      loopCounters: input.resume?.state.loopCounters ?? {},
      visitCounts: input.resume?.state.visitCounts ?? {},
      toolCalls: input.resume?.state.toolCalls ?? [],
      stepCounter: input.resume?.state.stepCounter ?? 0,
      providerUsed: input.resume?.state.providerUsed ?? null,
      startedAt,
      timeoutMs,
    };

    await this.deps.logRepo.log({
      executionId,
      event: "GRAPH_EXECUTION_STARTED",
      level: "INFO",
      status: "RUNNING",
      metadata: { nodes: graph.nodes.length, edges: graph.edges.length, resumed: Boolean(input.resume) },
    });
    executionEventBus.publish(executionId, { type: "execution:status", status: "RUNNING" });

    try {
      const startNode = this.findStartNode(graph);
      const firstNodeId = input.resume?.fromNodeId ?? startNode.id;
      const outcome = await this.walk(ctx, firstNodeId);

      // HITL pause — the approval node already persisted the pause position and
      // status; do NOT assemble/completion-persist on top of it.
      if (outcome === "paused") {
        return { status: "PAUSED_FOR_APPROVAL", finalOutput: null, providerUsed: ctx.providerUsed };
      }

      const durationMs = Date.now() - startedAt;
      const finalOutput = this.assembleFinalOutput(ctx);
      await this.deps.executionRepo.setRuntimeDetails(executionId, {
        provider: ctx.providerUsed ?? undefined,
        plannerOutput: {
          graph: true,
          state: this.snapshot(ctx),
        },
        durationMs,
      });
      await this.deps.executionRepo.setFinalOutput(executionId, finalOutput);
      await this.deps.logRepo.log({
        executionId,
        event: "GRAPH_EXECUTION_FINISHED",
        level: "INFO",
        status: "COMPLETED",
        durationMs,
        metadata: { steps: ctx.stepCounter, toolCalls: ctx.toolCalls.length },
      });
      executionEventBus.publish(executionId, { type: "execution:status", status: "COMPLETED" });
      return { status: "COMPLETED", finalOutput, providerUsed: ctx.providerUsed };
    } catch (error) {
      return this.handleFailure(executionId, error, startedAt, ctx);
    }
  }

  private findStartNode(graph: AgentGraphDefinition): GraphNodeDefinition {
    const start = graph.nodes.find((n) => n.type === "start");
    if (!start) throw new ExecutionError("Graph has no START node", "GRAPH_FAILURE");
    return start;
  }

  /**
   * Walk the graph from a node until an END node, a HITL pause, or a step
   * limit. Cycle safety comes from per-node visit counters plus the loop
   * node's own iteration counter.
   */
  private async walk(ctx: WalkCtx, nodeId: string): Promise<"completed" | "paused"> {
    let currentId = nodeId;
    const graph = ctx.graph;

    while (true) {
      if (ctx.signal?.aborted) {
        throw new ExecutionCancelledError("Execution cancelled");
      }
      this.checkTimeout(ctx);

      const node = graph.nodes.find((n) => n.id === currentId);
      if (!node) throw new ExecutionError(`Graph node "${currentId}" not found`, "GRAPH_FAILURE");

      ctx.stepCounter += 1;
      if (ctx.stepCounter > (ctx.version.maxExecutionSteps || 10) * 4) {
        throw new StepLimitExceededError(
          `Graph execution exceeded the step budget (max ${(ctx.version.maxExecutionSteps || 10) * 4} node executions)`
        );
      }
      if ((ctx.visitCounts[currentId] ?? 0) > MAX_NODE_VISITS) {
        throw new StepLimitExceededError(`Node "${node.data.label}" executed too many times (possible infinite loop)`);
      }
      ctx.visitCounts[currentId] = (ctx.visitCounts[currentId] ?? 0) + 1;

      if (node.type === "end") {
        executionEventBus.publish(ctx.executionId, {
          type: "node:start",
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.type,
        });
        await this.persistStep(ctx, node, "SUCCESS", { terminal: true });
        executionEventBus.publish(ctx.executionId, {
          type: "node:end",
          nodeId: node.id,
          status: "SUCCESS",
        });
        return "completed";
      }

      const outgoing = graph.edges.filter((e) => e.source === node.id);

      // START node — pass through to its single successor.
      if (node.type === "start") {
        executionEventBus.publish(ctx.executionId, {
          type: "node:start",
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.type,
        });
        await this.persistStep(ctx, node, "SUCCESS", { passThrough: true });
        executionEventBus.publish(ctx.executionId, {
          type: "node:end",
          nodeId: node.id,
          status: "SUCCESS",
        });
        const next = this.firstSuccessor(outgoing, node);
        this.emitEdgeTraversal(ctx, node.id, next);
        currentId = next;
        continue;
      }

      // Publish start, then execute.
      executionEventBus.publish(ctx.executionId, {
        type: "node:start",
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.type,
      });
      const result = await this.executeNode(ctx, node, outgoing);

      if (result === "paused") {
        // HITL pause — state was persisted by the caller (approval node).
        return "paused";
      }
      if (result === "ended") {
        // Node reached a terminal without an END node (e.g. parallel join to nothing).
        await this.persistStep(ctx, node, "SUCCESS", { ended: true });
        executionEventBus.publish(ctx.executionId, {
          type: "node:end",
          nodeId: node.id,
          status: "SUCCESS",
        });
        return "completed";
      }

      this.emitEdgeTraversal(ctx, node.id, result);
      currentId = result;
    }
  }

  /** Execute one node and return the next node id, "paused", or "ended". */
  private async executeNode(
    ctx: WalkCtx,
    node: GraphNodeDefinition,
    outgoing: GraphEdgeDefinition[]
  ): Promise<string | "paused" | "ended"> {
    switch (node.type) {
      case "agent":
        return this.runAgentNode(ctx, node, outgoing);
      case "supervisor":
        return this.runSupervisorNode(ctx, node, outgoing);
      case "tool":
        return this.runToolNode(ctx, node, outgoing);
      case "router":
        return this.runRouterNode(ctx, node, outgoing);
      case "approval":
        return this.runApprovalNode(ctx, node, outgoing);
      case "loop":
        return this.runLoopNode(ctx, node, outgoing);
      case "parallel":
        return this.runParallelNode(ctx, node, outgoing);
      default:
        throw new ExecutionError(`Unsupported graph node type "${node.type}"`, "GRAPH_FAILURE");
    }
  }

  private async runAgentNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const output = await this.callLLM(ctx, node, "agent");
    ctx.results[node.id] = output;
    ctx.providerUsed = ctx.providerUsed ?? this.deps.llm?.name ?? null;
    await this.persistStep(ctx, node, "SUCCESS", { output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", summarize(output));
    return this.firstSuccessor(outgoing, node);
  }

  private async runSupervisorNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const output = await this.callLLM(ctx, node, "supervisor", {
      instruction: `You are a supervisor routing work to one of the following next steps: ${JSON.stringify(
        outgoing.map((e) => e.label || e.target)
      )}. Respond with ONLY a JSON object: {"next": "<exact label or node id>"}`,
    });
    ctx.results[node.id] = output;
    ctx.providerUsed = ctx.providerUsed ?? this.deps.llm?.name ?? null;
    const parsed = typeof output === "string" ? extractJsonObject(output) : null;
    const nextLabel = parsed?.next as string | undefined;
    const chosen =
      (nextLabel ? outgoing.find((e) => e.label === nextLabel || e.target === nextLabel) : undefined) ??
      outgoing[0];
    await this.persistStep(ctx, node, "SUCCESS", { routedTo: chosen?.target, decision: nextLabel ?? null });
    this.emitNodeEnd(ctx, node, "SUCCESS", `routed → ${chosen?.label ?? chosen?.target}`);
    return chosen?.target ?? "ended";
  }

  private async runToolNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const toolName = data.toolName ?? "";
    if (!toolName) throw new ExecutionError(`Tool node "${node.data.label}" has no tool selected`, "GRAPH_FAILURE");

    const allowed = ctx.version.allowedTools ?? [];
    const verdict = this.deps.permissionChecker.check(toolName, allowed, this.deps.toolRegistry);
    if (!verdict.ok) {
      throw new ExecutionError(verdict.reason, "UNAUTHORIZED_TOOL");
    }

    const resolvedInput = resolveTemplate(data.inputTemplate ?? {}, ctx);
    const executionInput = { ...(resolvedInput as Record<string, unknown>), ...(data.action ? { action: data.action } : {}) };

    const started = Date.now();
    const output = await this.deps.toolRegistry.executeTool(toolName, executionInput);
    const durationMs = Date.now() - started;

    const record: ToolCallRecord = {
      stepNumber: ctx.stepCounter,
      toolName,
      action: data.action ?? "run",
      input: executionInput,
      status: "SUCCESS",
      output,
      requiresApproval: false,
      durationMs,
    };
    ctx.toolCalls.push(record);
    ctx.results[node.id] = output;
    await this.deps.executionRepo.addToolCall(ctx.executionId, {
      toolName,
      action: data.action ?? "run",
      inputArgs: executionInput,
      outputResult: (output as Record<string, unknown> | undefined) ?? undefined,
      status: "SUCCESS",
      durationMs,
    });
    await this.persistStep(ctx, node, "SUCCESS", { tool: toolName, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `${toolName} → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  private async runRouterNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    let decision: string | null = null;

    if (data.routerMode === "ai") {
      const output = await this.callLLM(ctx, node, "router", {
        instruction: `You are a router. Choose exactly one of the following outcomes: ${JSON.stringify(
          outgoing.map((e) => e.label || e.target)
        )}. Respond with ONLY a JSON object: {"next": "<exact label or node id>"}`,
      });
      const parsed = typeof output === "string" ? extractJsonObject(output) : null;
      decision = (parsed?.next as string | undefined) ?? null;
    } else {
      const expression = data.condition ?? "";
      if (!expression) throw new ExecutionError(`Router node "${node.data.label}" has no condition`, "GRAPH_FAILURE");
      try {
        const matched = evaluateExpression(expression, {
          results: ctx.results,
          input: ctx.userInput,
          item: ctx.item,
        });
        decision = matched ? "true" : "false";
      } catch (error) {
        if (error instanceof ExpressionError) {
          throw new ExecutionError(`Router condition error in "${node.data.label}": ${error.message}`, "GRAPH_FAILURE");
        }
        throw error;
      }
    }

    const chosen =
      (decision ? outgoing.find((e) => e.label === decision) : undefined) ??
      outgoing.find((e) => !e.label) ??
      outgoing[0];
    ctx.results[node.id] = { decision: chosen?.label ?? chosen?.target ?? null };
    await this.persistStep(ctx, node, "SUCCESS", { condition: data.condition ?? null, decision: chosen?.label ?? null });
    this.emitNodeEnd(ctx, node, "SUCCESS", `→ ${chosen?.label ?? chosen?.target}`);
    return chosen?.target ?? "ended";
  }

  private async runApprovalNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const action = data.action ?? "approve_graph_action";
    const idempotencyKey = `graph-${ctx.executionId}-${node.id}`;

    // Resume path: an approved request exists for this node — continue, don't re-pause.
    const existing = await this.deps.approvalRepo.findByIdempotencyKey(idempotencyKey);
    if (existing?.status === "APPROVED") {
      ctx.results[node.id] = { approved: true };
      await this.persistStep(ctx, node, "SUCCESS", { approved: true, resumed: true });
      this.emitNodeEnd(ctx, node, "SUCCESS", "approved");
      return this.firstSuccessor(outgoing, node);
    }

    await this.deps.approvalRepo.upsertByIdempotencyKey({
      executionId: ctx.executionId,
      userId: ctx.skill.userId,
      skillName: ctx.skill.name,
      plannerReason: data.approvalReason ?? `Human approval required at node "${node.data.label}"`,
      toolName: node.data.label,
      action,
      inputPayload: { nodeId: node.id, reason: data.approvalReason ?? null },
      idempotencyKey,
    });

    await this.persistStep(ctx, node, "AWAITING_APPROVAL", { action, nodeId: node.id });
    this.emitNodeEnd(ctx, node, "AWAITING_APPROVAL", `awaiting approval for ${action}`);
    executionEventBus.publish(ctx.executionId, { type: "execution:status", status: "PAUSED_FOR_APPROVAL" });
    await this.deps.logRepo.log({
      executionId: ctx.executionId,
      event: "GRAPH_APPROVAL_REQUESTED",
      level: "WARN",
      status: "AWAITING_APPROVAL",
      metadata: { nodeId: node.id, action },
    });

    // Persist the exact position so resume continues from the successor.
    await this.deps.executionRepo.setRuntimeDetails(ctx.executionId, {
      plannerOutput: {
        graph: true,
        pausedAtNodeId: node.id,
        state: this.snapshot(ctx),
      },
    });
    await this.deps.executionRepo.updateStatus(ctx.executionId, "PAUSED_FOR_APPROVAL");
    return "paused";
  }

  private async runLoopNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const maxIterations = node.data.maxIterations ?? 3;
    const iteration = (ctx.loopCounters[node.id] ?? 0) + 1;
    ctx.loopCounters[node.id] = iteration;

    const bodyEdge = outgoing.find((e) => e.label === "body") ?? outgoing[0];
    const exitEdge = outgoing.find((e) => e.label === "exit") ?? outgoing[outgoing.length - 1];

    const shouldExit = iteration > maxIterations;
    const chosen = shouldExit ? exitEdge : bodyEdge;
    ctx.results[node.id] = { iteration, exited: shouldExit };
    await this.persistStep(ctx, node, "SUCCESS", { iteration, exited: shouldExit });
    this.emitNodeEnd(ctx, node, "SUCCESS", shouldExit ? `exit (${iteration - 1}/${maxIterations})` : `iteration ${iteration}/${maxIterations}`);

    // If looping back into a body that converges on this loop node, the
    // counter protects us — no extra visited-set machinery needed.
    return chosen?.target ?? "ended";
  }

  /**
   * Parallel (map-reduce) node.
   *  - map mode: `mapField` resolves to an array; the outgoing edge labelled
   *    "worker" (or the first edge) is run once per item concurrently; results
   *    collect under results[node.id].outputs; then the "join" edge (or the
   *    last edge) continues.
   *  - fan-out: all outgoing edges except a "join"-labelled one run
   *    concurrently as branches; results collect per branch.
   */
  private async runParallelNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const joinEdge = outgoing.find((e) => e.label === "join") ?? null;
    const branchEdges = outgoing.filter((e) => e !== joinEdge);

    if (data.parallelMode === "map" && data.mapField) {
      const items = resolvePath(data.mapField, ctx);
      if (!Array.isArray(items)) {
        throw new ExecutionError(`Parallel node "${node.data.label}": mapField "${data.mapField}" did not resolve to an array`, "GRAPH_FAILURE");
      }
      const workerEdge = branchEdges.find((e) => e.label === "worker") ?? branchEdges[0];
      const workerNodeId = workerEdge?.target;
      if (!workerNodeId) {
        throw new ExecutionError(`Parallel node "${node.data.label}" needs a worker edge`, "GRAPH_FAILURE");
      }
      const outputs: unknown[] = [];
      await Promise.all(
        items.map(async (item, idx) => {
          const sub = this.childCtx(ctx, item, `${data.mapField}[${idx}]`);
          await this.walkLinear(sub, workerNodeId);
          outputs[idx] = sub.results[workerNodeId];
        })
      );
      ctx.results[node.id] = { outputs, count: outputs.length };
      await this.persistStep(ctx, node, "SUCCESS", { mode: "map", count: outputs.length });
      this.emitNodeEnd(ctx, node, "SUCCESS", `map over ${outputs.length} items`);
      const next = joinEdge;
      return next?.target ?? "ended";
    }

    // Fan-out: run each branch concurrently, collect per-branch outputs.
    const branchTargets = branchEdges.map((e) => e.target);
    const branchOutputs: Record<string, unknown> = {};
    await Promise.all(
      branchTargets.map(async (targetId) => {
        const sub = this.childCtx(ctx, undefined, node.id);
        await this.walkLinear(sub, targetId);
        branchOutputs[targetId] = sub.results[targetId];
      })
    );
    ctx.results[node.id] = { branches: branchOutputs };
    await this.persistStep(ctx, node, "SUCCESS", { mode: "fan-out", branches: branchTargets.length });
    this.emitNodeEnd(ctx, node, "SUCCESS", `fanned out to ${branchTargets.length} branches`);
    const next = joinEdge;
    return next?.target ?? "ended";
  }

  /** A bounded linear sub-walk used for parallel branches — follows single-successor chains. */
  private async walkLinear(ctx: WalkCtx, startNodeId: string): Promise<void> {
    let currentId = startNodeId;
    let hops = 0;
    while (currentId && hops < 100) {
      hops += 1;
      const node = ctx.graph.nodes.find((n) => n.id === currentId);
      if (!node) throw new ExecutionError(`Graph node "${currentId}" not found`, "GRAPH_FAILURE");
      if (node.type === "end") return;

      // HITL pauses inside a parallel branch would clobber the main-path pause
      // position and snapshot — reject them up front with a clear error.
      if (node.type === "approval") {
        throw new ExecutionError(
          `Approval node "${node.data.label}" is inside a parallel branch — approvals are only supported on the main path`,
          "GRAPH_FAILURE"
        );
      }

      const outgoing = ctx.graph.edges.filter((e) => e.source === node.id);
      ctx.stepCounter += 1;
      if (ctx.stepCounter > (ctx.version.maxExecutionSteps || 10) * 4) {
        throw new StepLimitExceededError("Graph execution exceeded the step budget");
      }
      this.checkTimeout(ctx);
      executionEventBus.publish(ctx.executionId, {
        type: "node:start",
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.type,
      });
      const result = await this.executeNode(ctx, node, outgoing);
      if (result === "paused") {
        throw new ExecutionError(
          `Node "${node.data.label}" cannot pause inside a parallel branch`,
          "GRAPH_FAILURE"
        );
      }
      if (result === "ended" || result === "completed") return;
      this.emitEdgeTraversal(ctx, node.id, result);
      currentId = result;
    }
  }

  /** Clone the walk context for a parallel sub-walk (isolated results, shared counters). */
  private childCtx(ctx: WalkCtx, item: unknown, itemPath?: string): WalkCtx {
    return {
      ...ctx,
      results: {},
      item,
      itemPath,
    };
  }

  /** Enforce the wall-clock budget at the top of each walk iteration. */
  private checkTimeout(ctx: WalkCtx): void {
    if (ctx.timeoutMs > 0 && Date.now() - ctx.startedAt > ctx.timeoutMs) {
      const seconds = Math.round(ctx.timeoutMs / 1000);
      throw new StepLimitExceededError(
        `Graph execution timed out after ${seconds >= 1 ? `${seconds}s` : `${ctx.timeoutMs}ms`}`
      );
    }
  }

  /** Publish the edge-traversed event for the transition node → next. */
  private emitEdgeTraversal(ctx: WalkCtx, sourceId: string, targetId: string): void {
    if (targetId === "ended") return;
    const edge = ctx.graph.edges.find((e) => e.source === sourceId && e.target === targetId);
    executionEventBus.publish(ctx.executionId, {
      type: "edge:traverse",
      sourceId,
      targetId,
      ...(edge?.id ? { edgeId: edge.id } : {}),
      ...(edge?.label ? { label: edge.label } : {}),
    });
  }

  private async callLLM(
    ctx: WalkCtx,
    node: GraphNodeDefinition,
    role: string,
    extra?: { instruction?: string }
  ): Promise<unknown> {
    const data = node.data;
    const systemPrompt =
      data.prompt ??
      `You are the "${node.data.label}" ${role} in a multi-agent workflow. Analyze the context and produce a thorough response.`;

    const context = {
      role,
      node: node.data.label,
      input: ctx.userInput,
      results: ctx.results,
      ...(ctx.item !== undefined ? { item: ctx.item } : {}),
      ...(extra?.instruction ? { instruction: extra.instruction } : {}),
    };

    const messages: LLMChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `WORKFLOW CONTEXT (JSON):\n${JSON.stringify(context, null, 2)}\n\nProvide your output.`,
      },
    ];

    const completion = await ctx.llm.complete(messages, { temperature: 0.2, maxTokens: 800 });
    return completion.content;
  }

  private firstSuccessor(outgoing: GraphEdgeDefinition[], node: GraphNodeDefinition): string | "ended" {
    if (outgoing.length === 0) return "ended";
    return outgoing[0].target;
  }

  private assembleFinalOutput(ctx: WalkCtx): Record<string, unknown> {
    return {
      results: ctx.results,
      providerUsed: ctx.providerUsed,
      stepCount: ctx.stepCounter,
      toolCalls: ctx.toolCalls.length,
    };
  }

  private snapshot(ctx: WalkCtx): GraphState {
    return {
      results: ctx.results,
      loopCounters: ctx.loopCounters,
      visitCounts: ctx.visitCounts,
      toolCalls: ctx.toolCalls,
      stepCounter: ctx.stepCounter,
      providerUsed: ctx.providerUsed,
    };
  }

  private async persistStep(ctx: WalkCtx, node: GraphNodeDefinition, status: "RUNNING" | "SUCCESS" | "FAILED" | "AWAITING_APPROVAL", snapshot: Record<string, unknown>) {
    const now = new Date();
    await this.deps.executionRepo.addStep(ctx.executionId, {
      stepNumber: ctx.stepCounter,
      nodeName: node.id,
      stateSnapshot: { type: node.type, label: node.data.label, ...snapshot },
      status,
      startedAt: now,
      completedAt: now,
    });
  }

  private emitNodeEnd(ctx: WalkCtx, node: GraphNodeDefinition, status: GraphNodeStatus, detail?: string) {
    executionEventBus.publish(ctx.executionId, {
      type: "node:end",
      nodeId: node.id,
      status,
      detail,
    });
  }

  private async handleFailure(
    executionId: string,
    error: unknown,
    startedAt: number,
    ctx: WalkCtx
  ): Promise<GraphRunResult> {
    const message = error instanceof Error ? error.message : "Graph execution failed";
    let status: ExecutionStatus = "FAILED";
    if (error instanceof ExecutionCancelledError) status = "CANCELLED";
    else if (error instanceof StepLimitExceededError) status = "STEP_LIMIT_EXCEEDED";

    const durationMs = Date.now() - startedAt;
    try {
      await this.deps.executionRepo.updateStatus(executionId, status, status === "CANCELLED" ? undefined : message);
      await this.deps.executionRepo.setRuntimeDetails(executionId, {
        plannerOutput: { graph: true, state: this.snapshot(ctx) },
        durationMs,
      });
      await this.deps.logRepo.log({
        executionId,
        event: "GRAPH_EXECUTION_FAILED",
        level: status === "CANCELLED" ? "WARN" : "ERROR",
        status,
        durationMs,
        metadata: { error: message },
      });
    } catch {
      // Never mask the original error with persistence failures.
    }
    executionEventBus.publish(executionId, { type: "execution:status", status });
    logger.error({ executionId, status, error: message }, "Graph execution failed");
    return { status, finalOutput: null, providerUsed: ctx.providerUsed, error: message };
  }
}

function summarize(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length > 120 ? `${str.slice(0, 120)}…` : str;
}
