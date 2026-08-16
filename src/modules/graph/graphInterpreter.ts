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
  /**
   * Global token budget for LLM calls across the run. Enforced only when the
   * provider reports usage. Default 200k input+output tokens.
   */
  maxTokens?: number;
}

/** Runtime state that must survive a HITL pause so the run resumes in place. */
export interface GraphState {
  results: Record<string, unknown>;
  loopCounters: Record<string, number>;
  visitCounts: Record<string, number>;
  toolCalls: ToolCallRecord[];
  stepCounter: number;
  providerUsed: string | null;
  /** Edge ids traversed during the run — drives the branch-coverage view. */
  traversedEdges?: string[];
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
  /**
   * Ghost-mode preview: executes the graph exactly as a real run would
   * (tools + LLM nodes) but persists NOTHING — no steps, tool calls, status
   * updates, logs or approval requests. Approval nodes auto-pass. Events are
   * still published so the canvas can trace the predicted path.
   */
  dryRun?: boolean;
  /**
   * Deterministic replay: recorded LLM outputs keyed by node id. When a node
   * has a replay entry its LLM call is skipped and the recorded output is
   * returned — the run follows the exact same path without spending tokens.
   */
  replayOutputs?: Record<string, unknown>;
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
  /** Ghost-mode preview — skip all persistence, auto-pass approvals. */
  dryRun: boolean;
  /** Epoch ms when the current node started executing (for per-node metrics). */
  nodeStartedAt?: number;
  /** Recorded LLM outputs keyed by node id (deterministic replay). */
  replayOutputs?: Record<string, unknown>;
  /** Edge ids traversed so far — persists into state for branch coverage. */
  traversedEdges: string[];
  /** Global token budget for LLM calls (0 = unlimited). */
  maxTokens: number;
  /** Tokens consumed so far (input + output). */
  tokensUsed: number;
  /** Per-node token consumption — flags the node that blew the budget. */
  nodeTokens: Record<string, number>;
  /** Nested subgraph run — suppress inner node events, reject approvals. */
  silent?: boolean;
  /** Outer subgraph node id — prefixes inner step names for the timeline. */
  subgraphOwner?: string;
  /** Subgraph nesting depth (recursion guard). */
  depth?: number;
  /** Node id currently being iterated (map mode) — exposed as `item`. */
  item?: unknown;
  /** Map mode: path to the item that produced this sub-walk (for labels). */
  itemPath?: string;
}

const MAX_NODE_VISITS = 200;
const MAX_SUBGRAPH_DEPTH = 8;

/** Default wall-clock budget for a graph run (see GraphInterpreterDeps.timeoutMs). */
const DEFAULT_TIMEOUT_MS = 120_000;

/** Default global token budget for LLM calls across the run. */
const DEFAULT_MAX_TOKENS = 200_000;

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

/**
 * Resolve a mapping value that is either a braced template (`{{ results.x.y }}`)
 * or a bare path expression (`results.x.y`).
 */
function resolveMappingTemplate(value: string, ctx: WalkCtx): unknown {
  const trimmed = value.trim();
  if (trimmed.includes("{{ ") || trimmed.includes("{{")) return resolveTemplate(trimmed, ctx);
  return resolvePath(trimmed, ctx);
}

export class GraphInterpreter {
  constructor(private deps: GraphInterpreterDeps) {}

  async run(input: GraphRunInput): Promise<GraphRunResult> {
    const startedAt = Date.now();
    const timeoutMs = this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxTokens = this.deps.maxTokens ?? DEFAULT_MAX_TOKENS;
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
      dryRun: input.dryRun ?? false,
      replayOutputs: input.replayOutputs,
      traversedEdges: input.resume?.state.traversedEdges ?? [],
      maxTokens,
      tokensUsed: 0,
      nodeTokens: {},
    };

    if (!ctx.dryRun) {
      await this.deps.logRepo.log({
        executionId,
        event: "GRAPH_EXECUTION_STARTED",
        level: "INFO",
        status: "RUNNING",
        metadata: { nodes: graph.nodes.length, edges: graph.edges.length, resumed: Boolean(input.resume) },
      });
    }
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
      if (!ctx.dryRun) {
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
      }
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

      const nodeDuration = () => (ctx.nodeStartedAt ? Date.now() - ctx.nodeStartedAt : undefined);

      if (node.type === "end") {
        this.emit(ctx, {
          type: "node:start",
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.type,
        });
        await this.persistStep(ctx, node, "SUCCESS", { terminal: true });
        this.emit(ctx, {
          type: "node:end",
          nodeId: node.id,
          status: "SUCCESS",
          durationMs: nodeDuration(),
        });
        return "completed";
      }

      const outgoing = graph.edges.filter((e) => e.source === node.id);

      // START node — pass through to its single successor.
      if (node.type === "start") {
        this.emit(ctx, {
          type: "node:start",
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.type,
        });
        await this.persistStep(ctx, node, "SUCCESS", { passThrough: true });
        this.emit(ctx, {
          type: "node:end",
          nodeId: node.id,
          status: "SUCCESS",
          durationMs: 0,
        });
        const next = this.firstSuccessor(outgoing, node);
        this.emitEdgeTraversal(ctx, node.id, next);
        currentId = next;
        continue;
      }

      // Publish start, then execute. The per-node clock drives the metrics.
      ctx.nodeStartedAt = Date.now();
      this.emit(ctx, {
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
        this.emit(ctx, {
          type: "node:end",
          nodeId: node.id,
          status: "SUCCESS",
          durationMs: nodeDuration(),
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
      case "subgraph":
        return this.runSubgraphNode(ctx, node, outgoing);
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
    if (!ctx.dryRun) {
      await this.deps.executionRepo.addToolCall(ctx.executionId, {
        toolName,
        action: data.action ?? "run",
        inputArgs: executionInput,
        outputResult: (output as Record<string, unknown> | undefined) ?? undefined,
        status: "SUCCESS",
        durationMs,
      });
    }
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

    // Approvals inside nested subgraphs would break the flat pause/resume
    // contract — reject them up front with a clear error.
    if (ctx.silent) {
      throw new ExecutionError(
        `Approval node "${node.data.label}" is inside a subgraph — approvals are only supported on the main path`,
        "GRAPH_FAILURE"
      );
    }

    // Ghost-mode preview: approvals auto-pass — the point is to predict the
    // path, not create HITL requests.
    if (ctx.dryRun) {
      ctx.results[node.id] = { approved: true, preview: true };
      await this.persistStep(ctx, node, "SUCCESS", { approved: true, preview: true });
      this.emitNodeEnd(ctx, node, "SUCCESS", "preview · auto-approved");
      return this.firstSuccessor(outgoing, node);
    }

    // HITL escalation rule: when the auto-approve condition is set and true,
    // the gate passes without a human — only genuinely risky cases pause.
    if (data.autoApproveCondition) {
      try {
        const matched = evaluateExpression(data.autoApproveCondition, {
          results: ctx.results,
          input: ctx.userInput,
          item: ctx.item,
        });
        if (matched) {
          ctx.results[node.id] = { approved: true, autoApproved: true };
          await this.persistStep(ctx, node, "SUCCESS", { approved: true, autoApproved: true });
          this.emitNodeEnd(ctx, node, "SUCCESS", "auto-approved by condition");
          await this.deps.logRepo.log({
            executionId: ctx.executionId,
            event: "GRAPH_APPROVAL_AUTO_PASSED",
            level: "INFO",
            status: "SUCCESS",
            metadata: { nodeId: node.id, condition: data.autoApproveCondition },
          });
          return this.firstSuccessor(outgoing, node);
        }
      } catch (error) {
        if (error instanceof ExpressionError) {
          throw new ExecutionError(
            `Auto-approve condition error in "${node.data.label}": ${error.message}`,
            "GRAPH_FAILURE"
          );
        }
        throw error;
      }
    }

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
      inputPayload: {
        nodeId: node.id,
        reason: data.approvalReason ?? null,
        ...(data.escalateAfterMin ? { escalateAfterMin: data.escalateAfterMin } : {}),
      },
      idempotencyKey,
    });

    // Auto-escalation timeout: a still-PENDING request leaves the review
    // queue after escalateAfterMin. Best-effort, in-process timer — in
    // multi-instance deployments a periodic sweep would be needed.
    if (data.escalateAfterMin) {
      const key = idempotencyKey;
      const escalateInMs = data.escalateAfterMin * 60_000;
      setTimeout(() => {
        void this.deps.approvalRepo
          .expireByIdempotencyKey(key)
          .then(() =>
            this.deps.logRepo.log({
              executionId: ctx.executionId,
              event: "GRAPH_APPROVAL_ESCALATED",
              level: "WARN",
              status: "EXPIRED",
              metadata: { nodeId: node.id, escalateAfterMin: data.escalateAfterMin },
            })
          )
          .catch(() => {
            // Best-effort — never crash the run for a failed timer.
          });
      }, escalateInMs).unref?.();
    }

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
      ctx.nodeStartedAt = Date.now();
      this.emit(ctx, {
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

  /**
   * Subgraph (macro) node: run the nested graph with an isolated context.
   * Inputs are resolved from the parent via `inputMapping`, outputs are
   * projected back via `outputMapping`. Inner events are suppressed — the
   * subgraph renders as one pulsing node on the canvas.
   */
  private async runSubgraphNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const inner = data.subgraph;
    if (!inner || !Array.isArray(inner.nodes) || inner.nodes.length === 0) {
      throw new ExecutionError(`Subgraph node "${node.data.label}" has no graph definition`, "GRAPH_FAILURE");
    }
    if ((ctx.depth ?? 0) >= MAX_SUBGRAPH_DEPTH) {
      throw new StepLimitExceededError(`Subgraph nesting exceeds ${MAX_SUBGRAPH_DEPTH} levels (possible recursion)`);
    }

    // Resolve inner inputs from parent state templates.
    const innerInput: Record<string, unknown> = {};
    for (const [key, template] of Object.entries(data.inputMapping ?? {})) {
      innerInput[key] = resolveMappingTemplate(template, ctx);
    }

    const nestedCtx: WalkCtx = {
      ...ctx,
      graph: inner,
      userInput: innerInput,
      results: {},
      loopCounters: {},
      visitCounts: {},
      traversedEdges: [],
      silent: true,
      subgraphOwner: node.id,
      depth: (ctx.depth ?? 0) + 1,
      item: undefined,
      itemPath: undefined,
      nodeStartedAt: undefined,
    };

    const innerStart = inner.nodes.find((n) => n.type === "start")?.id;
    if (!innerStart) {
      throw new ExecutionError(`Subgraph "${node.data.label}" has no START node`, "GRAPH_FAILURE");
    }

    const stepsBefore = ctx.stepCounter;
    const outcome = await this.walk(nestedCtx, innerStart);
    if (outcome === "paused") {
      // Unreachable: approvals are rejected inside nested runs.
      throw new ExecutionError(`Subgraph "${node.data.label}" paused unexpectedly`, "GRAPH_FAILURE");
    }

    // Project inner results back into the parent via outputMapping.
    const outputs: Record<string, unknown> = {};
    for (const [outerKey, template] of Object.entries(data.outputMapping ?? {})) {
      outputs[outerKey] = resolveMappingTemplate(template, nestedCtx);
    }
    ctx.results[node.id] = outputs;
    await this.persistStep(ctx, node, "SUCCESS", {
      macro: true,
      innerSteps: ctx.stepCounter - stepsBefore,
      outputKeys: Object.keys(outputs),
    });
    this.emitNodeEnd(ctx, node, "SUCCESS", `macro · ${inner.nodes.length} nodes → ${JSON.stringify(outputs).slice(0, 80)}`);
    return this.firstSuccessor(outgoing, node);
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
    if (edge?.id) ctx.traversedEdges.push(edge.id);
    this.emit(ctx, {
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
    // Deterministic replay — use the recorded output instead of the LLM.
    if (ctx.replayOutputs && Object.prototype.hasOwnProperty.call(ctx.replayOutputs, node.id)) {
      const recorded = ctx.replayOutputs[node.id];
      if (typeof recorded === "string") return recorded;
    }

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

    // Budget guardrail: accumulate provider-reported usage and stop the run
    // with the offending node named when the global budget is exceeded.
    if (completion.usage) {
      const consumed = completion.usage.inputTokens + completion.usage.outputTokens;
      ctx.tokensUsed += consumed;
      ctx.nodeTokens[node.id] = (ctx.nodeTokens[node.id] ?? 0) + consumed;
      if (ctx.maxTokens > 0 && ctx.tokensUsed > ctx.maxTokens) {
        throw new StepLimitExceededError(
          `Node "${node.data.label}" blew the token budget (${ctx.tokensUsed.toLocaleString()} / ${ctx.maxTokens.toLocaleString()} tokens)`
        );
      }
    }

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
      traversedEdges: ctx.traversedEdges,
    };
  }

  private async persistStep(ctx: WalkCtx, node: GraphNodeDefinition, status: "RUNNING" | "SUCCESS" | "FAILED" | "AWAITING_APPROVAL", snapshot: Record<string, unknown>) {
    // Ghost-mode previews persist nothing — the trace is event-driven only.
    if (ctx.dryRun) return;
    const now = new Date();
    await this.deps.executionRepo.addStep(ctx.executionId, {
      stepNumber: ctx.stepCounter,
      // Inner subgraph steps are namespaced so the timeline stays readable.
      nodeName: ctx.subgraphOwner ? `${ctx.subgraphOwner}:${node.id}` : node.id,
      stateSnapshot: {
        type: node.type,
        label: node.data.label,
        durationMs: ctx.nodeStartedAt ? Date.now() - ctx.nodeStartedAt : undefined,
        ...snapshot,
      },
      status,
      startedAt: now,
      completedAt: now,
    });
  }

  private emitNodeEnd(ctx: WalkCtx, node: GraphNodeDefinition, status: GraphNodeStatus, detail?: string) {
    this.emit(ctx, {
      type: "node:end",
      nodeId: node.id,
      status,
      detail,
      durationMs: ctx.nodeStartedAt ? Date.now() - ctx.nodeStartedAt : undefined,
    });
  }

  /** Publish an event unless this is a silent nested subgraph run. */
  private emit(ctx: WalkCtx, event: Parameters<typeof executionEventBus.publish>[1]): void {
    if (ctx.silent) return;
    executionEventBus.publish(ctx.executionId, event);
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
    if (!ctx.dryRun) {
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
