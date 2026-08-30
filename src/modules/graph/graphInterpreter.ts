import { LLMProvider, LLMChatMessage, getLLMProvider, getProviderForModel } from "@/providers/llm";
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
import { mcpToolRegistryName } from "@/modules/mcp/toolAdapter";

interface GraphInterpreterDeps {
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
  /**
   * Vault bridge — resolves `${vault.KEY}` placeholders in HTTP-node
   * url/headers/body against the owning user's secrets at node time.
   */
  resolveSecrets?: (userId: string, value: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /**
   * MCP server status probe for `mcp_server` nodes. Defaults to the real
   * McpServerRepository (ownership-scoped); injectable for tests/embedders.
   */
  getMcpServerStatus?: (
    serverId: string,
    userId: string
  ) => Promise<{ status: string; name: string; transport: string; cachedToolCount: number } | null>;
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

interface GraphRunInput {
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
    /**
     * Failure-retry mode: nodes whose outputs are already persisted in
     * `state.results` are REPLAYED (not re-executed) so a retry never
     * duplicates LLM calls or non-idempotent side effects.
     */
    skipCompletedNodes?: boolean;
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
  /** Failure-retry replay: skip nodes whose results are already persisted. */
  skipCompleted: boolean;
  /** Skill ids currently executing up this call chain (skill-node cycle guard). */
  skillChain: string[];
}

const MAX_NODE_VISITS = 200;
const MAX_SUBGRAPH_DEPTH = 8;

/** Node types whose persisted output can be replayed verbatim on a retry. */
const REPLAYABLE_NODE_TYPES = new Set([
  "agent",
  "supervisor",
  "tool",
  "router",
  "mcp_tool",
  "http",
  "transform",
  "aggregate",
  "variable",
  "output",
  "skill",
  "rss_feed",
  "web_reader",
  "notification_dispatcher",
  "data_mapper",
  "schedule_trigger",
  "webhook_trigger",
  "searxng_search",
  "crawl4ai_scrape",
  "docling_pdf_parser",
  "gotenberg_pdf_exporter",
  "nocodb_record",
  "pocketbase_store",
  "qdrant_vector_memory",
  "audio_transcriber",
  "piper_tts",
]);

/**
 * Derive the next node from a router/supervisor's recorded decision so a
 * retry replays the SAME branch instead of falling back to edge order.
 */
function replayRouterChoiceImpl(
  outgoing: GraphEdgeDefinition[],
  stored: unknown
): string | "ended" {
  const decision =
    stored && typeof stored === "object"
      ? ((stored as Record<string, unknown>).decision as string | undefined) ?? undefined
      : undefined;
  if (decision) {
    const match = outgoing.find((e) => e.label === decision);
    if (match) return match.target;
  }
  const unlabeled = outgoing.find((e) => !e.label);
  if (unlabeled) return unlabeled.target;
  return outgoing[0]?.target ?? "ended";
}

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
    // Balanced-brace scan (string-aware) instead of first"{"..last"}": the old
    // slice could swallow prose containing braces and yield invalid JSON.
    const start = candidate.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < candidate.length; i += 1) {
      const ch = candidate[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(candidate.slice(start, i + 1));
            return parsed && typeof parsed === "object" ? parsed : null;
          } catch {
            return null;
          }
        }
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
      // Unresolved single references surface as null instead of "" — a silent
      // empty string used to hide broken wiring until a downstream tool
      // failed with a confusing validation message.
      return resolved === undefined ? null : resolved;
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
      skipCompleted: input.resume?.skipCompletedNodes ?? false,
      skillChain: [skill.id],
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

      // Failure-retry replay: a node with an already-persisted result is not
      // re-executed — its stored output feeds downstream references and the
      // run continues from its successor. Routers/supervisors replay their
      // recorded decision so the retry takes the SAME branch.
      if (
        ctx.skipCompleted &&
        REPLAYABLE_NODE_TYPES.has(node.type) &&
        ctx.results[node.id] !== undefined
      ) {
        const replayOutgoing = graph.edges.filter((e) => e.source === node.id);
        this.emit(ctx, {
          type: "node:start",
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.type,
        });
        await this.persistStep(ctx, node, "SUCCESS", { replayed: true });
        this.emitNodeEnd(ctx, node, "SUCCESS", "replayed from persisted state");
        let next: string | "ended";
        if (node.type === "router" || node.type === "supervisor") {
          next = this.replayRouterChoice(node, replayOutgoing, ctx.results[node.id]);
        } else {
          next = this.firstSuccessor(replayOutgoing, node);
        }
        this.emitEdgeTraversal(ctx, node.id, next);
        currentId = next;
        continue;
      }

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
      case "mcp_server":
        return this.runMcpServerNode(ctx, node, outgoing);
      case "mcp_tool":
        return this.runMcpToolNode(ctx, node, outgoing);
      case "skill":
        return this.runSkillNode(ctx, node, outgoing);
      case "http":
        return this.runHttpNode(ctx, node, outgoing);
      case "transform":
        return this.runTransformNode(ctx, node, outgoing);
      case "delay":
        return this.runDelayNode(ctx, node, outgoing);
      case "aggregate":
        return this.runAggregateNode(ctx, node, outgoing);
      case "variable":
        return this.runVariableNode(ctx, node, outgoing);
      case "output":
        return this.runOutputNode(ctx, node, outgoing);
      case "schedule_trigger":
        return this.runScheduleTriggerNode(ctx, node, outgoing);
      case "webhook_trigger":
        return this.runWebhookTriggerNode(ctx, node, outgoing);
      case "rss_feed":
        return this.runRssFeedNode(ctx, node, outgoing);
      case "web_reader":
        return this.runWebReaderNode(ctx, node, outgoing);
      case "notification_dispatcher":
        return this.runNotificationDispatcherNode(ctx, node, outgoing);
      case "data_mapper":
        return this.runDataMapperNode(ctx, node, outgoing);
      case "searxng_search":
        return this.runSearxngNode(ctx, node, outgoing);
      case "crawl4ai_scrape":
        return this.runCrawl4AiNode(ctx, node, outgoing);
      case "docling_pdf_parser":
        return this.runDoclingNode(ctx, node, outgoing);
      case "gotenberg_pdf_exporter":
        return this.runGotenbergNode(ctx, node, outgoing);
      case "nocodb_record":
        return this.runNocodbNode(ctx, node, outgoing);
      case "pocketbase_store":
        return this.runPocketbaseNode(ctx, node, outgoing);
      case "qdrant_vector_memory":
        return this.runQdrantNode(ctx, node, outgoing);
      case "audio_transcriber":
        return this.runAudioTranscriberNode(ctx, node, outgoing);
      case "piper_tts":
        return this.runPiperTtsNode(ctx, node, outgoing);
      case "a2a_delegate":
        return this.runA2ADelegateNode(ctx, node, outgoing);
      case "a2a_channel":
        return this.runA2AChannelNode(ctx, node, outgoing);
      case "sticky_note":
      case "frame":
        // Visual-only nodes — pass through to successor.
        return this.firstSuccessor(outgoing, node);
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
    ctx.providerUsed = ctx.providerUsed ?? this.deps.llm?.name ?? null;
    const parsed = typeof output === "string" ? extractJsonObject(output) : null;
    const nextLabel = parsed?.next as string | undefined;
    const chosen =
      (nextLabel ? outgoing.find((e) => e.label === nextLabel || e.target === nextLabel) : undefined) ??
      outgoing[0];
    // Persist the routing decision so failure-retries can replay the SAME
    // branch instead of re-asking the LLM (or falling back to edge order).
    ctx.results[node.id] = { routedTo: chosen?.target ?? null, decision: nextLabel ?? null };
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

    // Emit tool call start event
    this.emit(ctx, {
      type: "tool:call:start",
      nodeId: node.id,
      toolName,
      action: data.action,
      input: executionInput,
    });

    const started = Date.now();
    let output: unknown;
    try {
      output = await this.deps.toolRegistry.executeTool(toolName, executionInput);
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);

      this.emit(ctx, {
        type: "tool:call:end",
        nodeId: node.id,
        toolName,
        status: "FAILED",
        error: message,
        durationMs,
      });

      const record: ToolCallRecord = {
        stepNumber: ctx.stepCounter,
        toolName,
        action: data.action ?? "run",
        input: executionInput,
        status: "ERROR",
        error: message,
        requiresApproval: false,
        durationMs,
      };
      ctx.toolCalls.push(record);
      if (!ctx.dryRun) {
        await this.deps.executionRepo.addToolCall(ctx.executionId, {
          toolName,
          action: data.action ?? "run",
          inputArgs: executionInput,
          status: "ERROR",
          errorMessage: message,
          durationMs,
        });
      }
      await this.persistStep(ctx, node, "FAILED", { tool: toolName, error: message });
      this.emitNodeEnd(ctx, node, "FAILED", `${toolName} failed: ${message}`);
      throw new ExecutionError(`Tool "${toolName}" failed on node "${node.data.label}": ${message}`, "GRAPH_FAILURE");
    }
    const durationMs = Date.now() - started;

    // Emit tool call end event
    this.emit(ctx, {
      type: "tool:call:end",
      nodeId: node.id,
      toolName,
      status: "SUCCESS",
      output,
      durationMs,
    });

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
      outgoing.find((e) => !e.label);
    if (!chosen) {
      // Silent misroute fix: previously fell back to outgoing[0], sending the
      // run down an arbitrary branch when labels didn't match. Fail loudly.
      throw new ExecutionError(
        `Router node "${node.data.label}" resolved to "${decision ?? "(no decision)"}" but no outgoing edge matches. Available labels: ${
          outgoing.map((e) => e.label || e.target).join(", ") || "(none)"
        }`,
        "GRAPH_FAILURE"
      );
    }
    ctx.results[node.id] = { decision: chosen?.label ?? chosen?.target ?? null };

    // Emit router decision event
    this.emit(ctx, {
      type: "router:decision",
      nodeId: node.id,
      mode: data.routerMode ?? "deterministic",
      chosenLabel: chosen?.label ?? chosen?.target ?? "",
      reason: data.routerMode === "ai" ? `AI chose: ${decision}` : `condition: ${data.condition}`,
    });

    await this.persistStep(ctx, node, "SUCCESS", { condition: data.condition ?? null, decision: chosen?.label ?? null });
    this.emitNodeEnd(ctx, node, "SUCCESS", `→ ${chosen?.label ?? chosen?.target}`);
    return chosen?.target ?? "ended";
  }

  private async runApprovalNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const action = data.action ?? "approve_graph_action";

    // Approvals inside nested subgraphs are a DELIBERATE unsupported
    // combination, not an oversight: the flat pause/resume contract persists
    // ONE resume position per execution (pausedAtNodeId + state snapshot).
    // Supporting nested pauses requires a stack of pause frames. Fail loudly;
    // canvas validation flags this at authoring time too.
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
          // Emit approval resolved event (auto-approved)
          this.emit(ctx, {
            type: "approval:resolved",
            nodeId: node.id,
            decision: "APPROVED",
          });
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
      // Emit approval resolved event
      this.emit(ctx, {
        type: "approval:resolved",
        nodeId: node.id,
        decision: "APPROVED",
      });
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

    // Emit approval requested event
    this.emit(ctx, {
      type: "approval:requested",
      nodeId: node.id,
      reason: data.approvalReason ?? undefined,
      action,
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

    const bodyEdge = outgoing.find((e) => e.label === "body");
    const exitEdge = outgoing.find((e) => e.label === "exit");

    const shouldExit = iteration > maxIterations;
    let chosen: GraphEdgeDefinition | undefined;
    if (shouldExit) {
      if (!exitEdge || exitEdge === bodyEdge) {
        // No real exit edge wired — terminate the walk instead of silently
        // looping on the body edge until the global visit cap.
        chosen = undefined;
      } else {
        chosen = exitEdge;
      }
    } else {
      chosen = bodyEdge ?? exitEdge;
    }
    ctx.results[node.id] = { iteration, exited: shouldExit };

    // Emit loop iteration event
    this.emit(ctx, {
      type: "loop:iteration",
      nodeId: node.id,
      iteration,
      maxIterations,
      exited: shouldExit,
    });

    await this.persistStep(ctx, node, "SUCCESS", { iteration, exited: shouldExit });
    this.emitNodeEnd(ctx, node, "SUCCESS", shouldExit ? `exit (${iteration - 1}/${maxIterations})` : `iteration ${iteration}/${maxIterations}`);

    // If looping back into a body that converges on this loop node, the
    // counter protects us — no extra visited-set machinery needed.
    if (!chosen) return "ended";
    return chosen.target;
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
          // Emit parallel branch start event
          this.emit(ctx, {
            type: "parallel:branch",
            nodeId: node.id,
            branchNodeId: workerNodeId,
            status: "started",
            mode: "map",
            branchIndex: idx,
          });

          const sub = this.childCtx(ctx, item, `${data.mapField}[${idx}]`);
          const lastNodeId = await this.walkLinear(sub, workerNodeId);
          // The worker chain may traverse several nodes — expose EVERY inner
          // output (namespaced per item) plus capture the LAST executed node's
          // result as the branch output. Previously only the first node's
          // output was captured and downstream aggregate/transform nodes saw
          // `undefined` for the rest of the chain.
          for (const [innerId, value] of Object.entries(sub.results)) {
            ctx.results[`${node.id}.items.${idx}.${innerId}`] = value;
          }
          outputs[idx] = lastNodeId ? sub.results[lastNodeId] : undefined;

          // Emit parallel branch end event
          this.emit(ctx, {
            type: "parallel:branch",
            nodeId: node.id,
            branchNodeId: workerNodeId,
            status: "completed",
            mode: "map",
            branchIndex: idx,
          });
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
        // Emit parallel branch start event
        this.emit(ctx, {
          type: "parallel:branch",
          nodeId: node.id,
          branchNodeId: targetId,
          status: "started",
          mode: "fan-out",
        });

        const sub = this.childCtx(ctx, undefined, node.id);
        const lastNodeId = await this.walkLinear(sub, targetId);
        if (lastNodeId) branchOutputs[targetId] = sub.results[lastNodeId];
        // Merge inner outputs into the PARENT context so a downstream
        // Aggregate node reading `results.<branchTailNodeId>` actually finds
        // them (fan-out branches are disjoint chains; first-writer wins on
        // the rare collision). Previously everything stayed in the throwaway
        // child context and joins read `undefined`.
        for (const [innerId, value] of Object.entries(sub.results)) {
          if (innerId in ctx.results && ctx.results[innerId] !== value) continue;
          ctx.results[innerId] = value;
        }

        // Emit parallel branch end event
        this.emit(ctx, {
          type: "parallel:branch",
          nodeId: node.id,
          branchNodeId: targetId,
          status: "completed",
          mode: "fan-out",
        });
      })
    );
    ctx.results[node.id] = { branches: branchOutputs };
    await this.persistStep(ctx, node, "SUCCESS", { mode: "fan-out", branches: branchTargets.length });
    this.emitNodeEnd(ctx, node, "SUCCESS", `fanned out to ${branchTargets.length} branches`);
    const next = joinEdge;
    return next?.target ?? "ended";
  }

  /** A bounded linear sub-walk used for parallel branches — follows single-successor chains. Returns the LAST executed node id (null when none). */
  private async walkLinear(ctx: WalkCtx, startNodeId: string): Promise<string | null> {
    let currentId: string | "ended" = startNodeId;
    let hops = 0;
    let lastNodeId: string | null = null;
    while (currentId && currentId !== "ended" && hops < 100) {
      hops += 1;
      const node = ctx.graph.nodes.find((n) => n.id === currentId);
      if (!node) throw new ExecutionError(`Graph node "${currentId}" not found`, "GRAPH_FAILURE");
      if (node.type === "end") return lastNodeId;

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
      if (result === "ended" || result === "completed") return node.id;
      this.emitEdgeTraversal(ctx, node.id, result);
      lastNodeId = node.id;
      currentId = result;
    }
    return lastNodeId;
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

    const effectiveModel = data.model;
    const hasCustomApi = Boolean(data.customApiBaseUrl || data.customApiKey);
    const activeLlm = (effectiveModel || hasCustomApi)
      ? getProviderForModel(effectiveModel, {
          customApiKey: data.customApiKey,
          customApiBaseUrl: data.customApiBaseUrl,
          customApiProvider: data.customApiProvider,
        })
      : ctx.llm;
    const modelLabel = effectiveModel || activeLlm.model || activeLlm.name;

    // Emit LLM call start event
    this.emit(ctx, {
      type: "llm:call:start",
      nodeId: node.id,
      model: modelLabel,
      promptPreview: systemPrompt.slice(0, 120),
    });

    const llmStarted = Date.now();
    let content = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let streamSucceeded = false;

    // 1. Attempt token-level streaming for real-time canvas rendering
    try {
      const streamIterable = await activeLlm.stream(messages, {
        temperature: data.temperature ?? 0.2,
        maxTokens: data.maxTokens ?? 800,
      });

      let tokenCount = 0;
      let inThinkingBlock = false;

      for await (const chunk of streamIterable) {
        if (chunk.usage) {
          if (typeof chunk.usage.inputTokens === "number") inputTokens = chunk.usage.inputTokens;
          if (typeof chunk.usage.outputTokens === "number") outputTokens = chunk.usage.outputTokens;
        }
        if (chunk.content) {
          content += chunk.content;
          tokenCount += 1;
          const elapsedSec = Math.max(0.05, (Date.now() - llmStarted) / 1000);
          const tokensPerSec = Math.round(tokenCount / elapsedSec);

          if (chunk.content.includes("<think>")) inThinkingBlock = true;
          if (chunk.content.includes("</think>")) inThinkingBlock = false;

          this.emit(ctx, {
            type: "node:token_chunk",
            nodeId: node.id,
            chunk: chunk.content,
            isThinking: inThinkingBlock,
            totalTokens: tokenCount,
            tokensPerSec,
          });
        }
      }

      if (content.length > 0) {
        streamSucceeded = true;
        if (!outputTokens) outputTokens = tokenCount;
        if (!inputTokens) inputTokens = Math.round(JSON.stringify(messages).length / 4);
      }
    } catch {
      // Fall through to complete() if streaming threw or is not supported
    }

    // 2. Fallback to complete() if stream yielded no tokens
    if (!streamSucceeded) {
      const completion = await activeLlm.complete(messages, {
        temperature: data.temperature ?? 0.2,
        maxTokens: data.maxTokens ?? 800,
      });
      content = completion.content;
      inputTokens = completion.usage?.inputTokens ?? Math.round(JSON.stringify(messages).length / 4);
      outputTokens = completion.usage?.outputTokens ?? Math.round(content.length / 4);

      // Emit chunk so canvas displays the result
      this.emit(ctx, {
        type: "node:token_chunk",
        nodeId: node.id,
        chunk: content,
        isThinking: false,
        totalTokens: outputTokens,
        tokensPerSec: 35,
      });
    }

    const llmDurationMs = Date.now() - llmStarted;

    // Emit LLM call end event
    this.emit(ctx, {
      type: "llm:call:end",
      nodeId: node.id,
      status: "SUCCESS",
      model: modelLabel,
      inputTokens,
      outputTokens,
      durationMs: llmDurationMs,
    });

    // Budget guardrail: accumulate usage and stop the run if limit is exceeded
    const consumed = inputTokens + outputTokens;
    ctx.tokensUsed += consumed;
    ctx.nodeTokens[node.id] = (ctx.nodeTokens[node.id] ?? 0) + consumed;
    if (ctx.maxTokens > 0 && ctx.tokensUsed > ctx.maxTokens) {
      throw new StepLimitExceededError(
        `Node "${node.data.label}" blew the token budget (${ctx.tokensUsed.toLocaleString()} / ${ctx.maxTokens.toLocaleString()} tokens)`
      );
    }

    return content;
  }

  private firstSuccessor(outgoing: GraphEdgeDefinition[], _node: GraphNodeDefinition): string | "ended" {
    if (outgoing.length === 0) return "ended";
    return outgoing[0].target;
  }

  /** Replay a router/supervisor's persisted branch choice (retry mode). */
  private replayRouterChoice(
    _node: GraphNodeDefinition,
    outgoing: GraphEdgeDefinition[],
    stored: unknown
  ): string | "ended" {
    return replayRouterChoiceImpl(outgoing, stored);
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

  // ══════════════════════════════════════════════════════════════════════
  // MCP, HTTP, Data, and Utility Node Handlers
  // ══════════════════════════════════════════════════════════════════════

  /**
   * MCP Server node — reflects the server's REAL persisted status from the
   * database instead of fabricating `connected`. A disconnected/unreachable
   * server now fails (or warns) honestly rather than passing through with a
   * green checkmark.
   */
  private async runMcpServerNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const serverId = node.data.mcpServerId ?? "";
    const lookup =
      this.deps.getMcpServerStatus ??
      (async (id: string, userId: string) => {
        const { McpServerRepository } = await import("@/repositories/McpServerRepository");
        const mcpRepo = new McpServerRepository();
        const server = await mcpRepo.findByIdForUser(id, userId);
        return server
          ? { status: server.status, name: server.name, transport: server.transport, cachedToolCount: server.cachedTools.length }
          : null;
      });
    const server = await lookup(serverId, ctx.skill.userId);
    if (!server) {
      throw new ExecutionError(
        `MCP Server node "${node.data.label}": server "${serverId}" not found or not owned by you`,
        "GRAPH_FAILURE"
      );
    }
    if (server.status !== "CONNECTED" && !ctx.dryRun) {
      throw new ExecutionError(
        `MCP Server node "${node.data.label}": server "${server.name}" is ${server.status}${" — connect it in the MCP Hub first"}`,
        "GRAPH_FAILURE"
      );
    }
    ctx.results[node.id] = {
      serverId,
      name: server.name,
      transport: server.transport,
      status: server.status,
      toolCount: server.cachedToolCount,
    };
    await this.persistStep(ctx, node, "SUCCESS", {
      mcpServer: serverId,
      status: server.status,
      toolCount: server.cachedToolCount,
    });
    this.emitNodeEnd(ctx, node, "SUCCESS", `MCP server ${server.name} · ${server.status}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** MCP Tool node — calls a registered MCP tool via the tool registry. */
  private async runMcpToolNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const toolName = data.mcpToolName ?? "";
    const serverId = data.mcpToolServer ?? "";
    if (!toolName || !serverId) {
      throw new ExecutionError(
        `MCP Tool node "${data.label}" is missing tool name or server ID`,
        "GRAPH_FAILURE"
      );
    }

    // MCP tools are registered in the tool registry as `mcp_<serverId>_<toolName>`
    const registryName = mcpToolRegistryName(serverId, toolName);

    const allowed = ctx.version.allowedTools ?? [];
    const verdict = this.deps.permissionChecker.check(registryName, allowed, this.deps.toolRegistry);
    if (!verdict.ok) {
      throw new ExecutionError(verdict.reason, "UNAUTHORIZED_TOOL");
    }

    const resolvedInput = resolveTemplate(data.mcpToolParams ?? {}, ctx);

    this.emit(ctx, {
      type: "mcp:tool:start",
      nodeId: node.id,
      serverId,
      toolName,
      params: resolvedInput,
    });

    const started = Date.now();
    let output: unknown;
    try {
      output = await this.deps.toolRegistry.executeTool(registryName, resolvedInput as Record<string, unknown>);
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);

      this.emit(ctx, {
        type: "mcp:tool:end",
        nodeId: node.id,
        serverId,
        toolName,
        status: "FAILED",
        error: message,
        durationMs,
      });

      const record: ToolCallRecord = {
        stepNumber: ctx.stepCounter,
        toolName: registryName,
        action: "mcp_call",
        input: resolvedInput as Record<string, unknown>,
        status: "ERROR",
        error: message,
        requiresApproval: false,
        durationMs,
      };
      ctx.toolCalls.push(record);
      if (!ctx.dryRun) {
        await this.deps.executionRepo.addToolCall(ctx.executionId, {
          toolName: registryName,
          action: "mcp_call",
          inputArgs: resolvedInput as Record<string, unknown>,
          status: "ERROR",
          errorMessage: message,
          durationMs,
        });
      }
      await this.persistStep(ctx, node, "FAILED", { tool: registryName, mcp: true, error: message });
      this.emitNodeEnd(ctx, node, "FAILED", `${toolName} failed: ${message}`);
      throw new ExecutionError(`MCP tool "${toolName}" failed on node "${node.data.label}": ${message}`, "GRAPH_FAILURE");
    }
    const durationMs = Date.now() - started;

    this.emit(ctx, {
      type: "mcp:tool:end",
      nodeId: node.id,
      serverId,
      toolName,
      status: "SUCCESS",
      output,
      durationMs,
    });

    const record: ToolCallRecord = {
      stepNumber: ctx.stepCounter,
      toolName: registryName,
      action: "mcp_call",
      input: resolvedInput as Record<string, unknown>,
      status: "SUCCESS",
      output,
      requiresApproval: false,
      durationMs,
    };
    ctx.toolCalls.push(record);
    ctx.results[node.id] = output;

    if (!ctx.dryRun) {
      await this.deps.executionRepo.addToolCall(ctx.executionId, {
        toolName: registryName,
        action: "mcp_call",
        inputArgs: resolvedInput as Record<string, unknown>,
        outputResult: (output as Record<string, unknown> | undefined) ?? undefined,
        status: "SUCCESS",
        durationMs,
      });
    }
    await this.persistStep(ctx, node, "SUCCESS", { tool: registryName, mcp: true, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `${toolName} → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Skill node — executes another installed skill as a sub-workflow. */
  private async runSkillNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const skillId = data.skillId ?? "";
    if (!skillId) {
      throw new ExecutionError(
        `Skill node "${data.label}" has no skill ID configured`,
        "GRAPH_FAILURE"
      );
    }
    // Cycle guard: A→B→A chains previously recursed until the step budget
    // blew up; now they fail fast with a clear message.
    if (ctx.skillChain.includes(skillId)) {
      throw new ExecutionError(
        `Skill node "${data.label}": circular skill reference detected (${[...ctx.skillChain, skillId].join(" → ")})`,
        "GRAPH_FAILURE"
      );
    }

    // Resolve input template against the current context
    const resolvedInput = resolveTemplate(data.skillInput ?? {}, ctx) as Record<string, unknown>;

    // Look up the skill and its latest version from the database
    const { SkillRepository } = await import("@/repositories/SkillRepository");
    const skillRepo = new SkillRepository();
    const targetSkill = await skillRepo.findById(skillId);
    if (!targetSkill) {
      throw new ExecutionError(
        `Skill node "${data.label}": skill "${skillId}" not found`,
        "GRAPH_FAILURE"
      );
    }
    // Tenant isolation for nested skills: the caller must OWN the target.
    if (targetSkill.userId !== ctx.skill.userId) {
      throw new ExecutionError(
        `Skill node "${data.label}": you do not have access to skill "${targetSkill.name}"`,
        "UNAUTHORIZED_TOOL"
      );
    }

    const version = targetSkill.publishedVersion ?? targetSkill.currentDraft;
    if (!version) {
      throw new ExecutionError(
        `Skill node "${data.label}": skill "${targetSkill.name}" has no published version`,
        "GRAPH_FAILURE"
      );
    }

    // If the target skill has a graph definition, run it through the graph interpreter
    if (version.graphDefinition && version.graphDefinition.nodes.length > 0) {
      const nestedResult = await this.run({
        executionId: ctx.executionId,
        skill: {
          id: targetSkill.id,
          userId: targetSkill.userId,
          name: targetSkill.name,
          purpose: targetSkill.purpose,
          status: targetSkill.status,
          createdAt: targetSkill.createdAt,
          updatedAt: targetSkill.updatedAt,
        },
        version,
        graph: version.graphDefinition,
        userInput: resolvedInput,
        signal: ctx.signal,
        dryRun: ctx.dryRun,
      });
      ctx.results[node.id] = nestedResult.finalOutput ?? { status: nestedResult.status };
    } else {
      // LINEAR skill: plan with the same LLM and execute each step through
      // the tool registry. Previously this branch returned a fabricated
      // `{ status: "invoked" }` WITHOUT running anything — canvas users got
      // green checkmarks over work that never happened.
      const { PlannerService } = await import("@/modules/execution/planner/plannerService");
      const { resolveStepReferences } = await import("@/modules/execution/executor/stepReferences");

      const planner = new PlannerService(ctx.llm);
      const availableTools = this.deps.toolRegistry
        .getAvailableTools()
        .filter((t) => version.allowedTools?.includes(t.name))
        .map((t) => ({ name: t.name, description: t.description, category: t.category }));

      const plan = await planner.plan({
        skill: { id: targetSkill.id, userId: targetSkill.userId, name: targetSkill.name, purpose: targetSkill.purpose, status: targetSkill.status, createdAt: targetSkill.createdAt, updatedAt: targetSkill.updatedAt },
        version,
        userInput: resolvedInput,
        availableTools,
      });

      ctx.providerUsed = ctx.providerUsed ?? planner.providerLabel;

      const results: Record<string, unknown> = {};
      let executedLlmSteps = 0;
      for (const step of plan.steps.slice(0, Math.max(1, version.maxExecutionSteps))) {
        const resolvedStepInput = resolveStepReferences(step.input, {
          results,
          userInput: resolvedInput,
        });
        const executionInput = { ...(resolvedStepInput as Record<string, unknown>), action: step.action };
        const isNoneTool = !step.toolName || step.toolName === "none" || step.toolName === "null";
        if (!isNoneTool) {
          // Enforce BOTH the child's allow-list and the parent's permission
          // surface before any side effect runs.
          if (!this.deps.permissionChecker.check(step.toolName, version.allowedTools ?? [], this.deps.toolRegistry).ok) {
            throw new ExecutionError(
              `Skill node "${data.label}": tool "${step.toolName}" is not allowed by skill "${targetSkill.name}"`,
              "UNAUTHORIZED_TOOL"
            );
          }
          const output = await this.deps.toolRegistry.executeTool(step.toolName, executionInput);
          results[`step_${step.stepNumber}`] = output;
        } else {
          // Reasoning-only step: one LLM turn with accumulated context.
          executedLlmSteps += 1;
          const completion = await ctx.llm.complete(
            [
              { role: "system", content: version.instructions },
              { role: "user", content: JSON.stringify({ input: resolvedInput, context: results, instruction: step.input }) },
            ],
            { temperature: 0.3, maxTokens: 600 }
          );
          results[`step_${step.stepNumber}`] = completion.content;
        }
      }
      ctx.results[node.id] = {
        skillId: targetSkill.id,
        skillName: targetSkill.name,
        status: "COMPLETED",
        steps: Object.keys(results).length,
        ...(executedLlmSteps > 0 ? { reasoningSteps: executedLlmSteps } : {}),
        results,
      };
      // Track the chain so downstream skill nodes in THIS walk can detect cycles.
      ctx.skillChain.push(targetSkill.id);
    }

    await this.persistStep(ctx, node, "SUCCESS", { skillId, skillName: targetSkill.name, input: summarize(resolvedInput) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `skill ${targetSkill.name}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** HTTP Request node — makes a real HTTP call to any REST/GraphQL endpoint. */
  private async runHttpNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const method = data.httpMethod ?? "GET";

    // `${vault.KEY}` placeholders in url/headers/body resolve against the
    // owning user's Vault before template resolution — secrets never appear
    // in the graph definition itself.
    let secretHeaders: Record<string, unknown> | undefined;
    if (data.httpHeaders && Object.keys(data.httpHeaders).length > 0 && this.deps.resolveSecrets) {
      try {
        secretHeaders = await this.deps.resolveSecrets(ctx.skill.userId, data.httpHeaders);
      } catch {
        secretHeaders = data.httpHeaders; // fail open to raw config; request will 401 loudly
      }
    }

    const url = resolveTemplate(data.httpUrl ?? "", ctx) as string;
    const headers = resolveTemplate(secretHeaders ?? data.httpHeaders ?? {}, ctx) as Record<string, string>;
    const body = data.httpBody ? resolveTemplate(data.httpBody, ctx) : undefined;
    const responseType = data.httpResponseType ?? "json";

    if (!url) {
      throw new ExecutionError(`HTTP node "${data.label}" has no URL configured`, "GRAPH_FAILURE");
    }

    this.emit(ctx, {
      type: "tool:call:start",
      nodeId: node.id,
      toolName: `http:${method}`,
      action: method,
      input: { url, method },
    });

    // Real abort plumbing: per-request timeout AND the execution's
    // cancellation signal. Previously fetch ran unbounded — a cancel could
    // not interrupt an in-flight call and a hung endpoint stalled the whole
    // run until the global wall clock.
    const timeoutMs = Math.min(
      typeof data.httpTimeoutMs === "number" ? data.httpTimeoutMs : 30_000,
      Math.max(1_000, ctx.timeoutMs || 30_000)
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onRunAbort = () => controller.abort();
    ctx.signal?.addEventListener("abort", onRunAbort, { once: true });

    const started = Date.now();
    let output: unknown;
    try {
      const fetchOptions: RequestInit = {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        signal: controller.signal,
      };
      if (body && method !== "GET") {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const durationMs = Date.now() - started;

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new ExecutionError(
          `HTTP ${method} ${url} returned ${response.status}: ${text.slice(0, 200)}`,
          "GRAPH_FAILURE"
        );
      }

      if (responseType === "text") {
        output = await response.text();
      } else if (responseType === "json") {
        output = await response.json();
      } else {
        // blob — return the status for now
        output = { status: response.status, contentType: response.headers.get("content-type") };
      }

      this.emit(ctx, {
        type: "tool:call:end",
        nodeId: node.id,
        toolName: `http:${method}`,
        status: "SUCCESS",
        output,
        durationMs,
      });

      const record: ToolCallRecord = {
        stepNumber: ctx.stepCounter,
        toolName: `http:${method}`,
        action: method,
        input: { url, method },
        status: "SUCCESS",
        output,
        requiresApproval: false,
        durationMs,
      };
      ctx.toolCalls.push(record);
      ctx.results[node.id] = output;

      if (!ctx.dryRun) {
        await this.deps.executionRepo.addToolCall(ctx.executionId, {
          toolName: `http:${method}`,
          action: method,
          inputArgs: { url, method },
          outputResult: (output as Record<string, unknown> | undefined) ?? undefined,
          status: "SUCCESS",
          durationMs,
        });
      }
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, {
        type: "tool:call:end",
        nodeId: node.id,
        toolName: `http:${method}`,
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });
      // Distinguish user cancellation from per-request timeout.
      if (ctx.signal?.aborted) throw new ExecutionCancelledError("Execution cancelled");
      if (error instanceof Error && error.name === "AbortError") {
        throw new ExecutionError(`HTTP ${method} ${url} timed out after ${timeoutMs}ms`, "GRAPH_FAILURE");
      }
      throw error;
    } finally {
      clearTimeout(timer);
      ctx.signal?.removeEventListener("abort", onRunAbort);
    }

    await this.persistStep(ctx, node, "SUCCESS", { http: method, url: url.slice(0, 120), output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `${method} ${url.slice(0, 60)} → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Transform node — applies data operations (map, filter, merge, flatten, sort, dedupe, pick, omit, template). */
  private async runTransformNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const op = data.transformOp ?? "map";
    const expr = data.transformExpr ?? "";

    // Collect input from the first incoming edge's source node result
    const incomingEdges = ctx.graph.edges.filter((e) => e.target === node.id);
    const sourceNodeId = incomingEdges[0]?.source;
    const sourceResult = sourceNodeId ? ctx.results[sourceNodeId] : undefined;
    const input = sourceResult ?? ctx.results;

    let output: unknown;

    switch (op) {
      case "map": {
        const arr = Array.isArray(input) ? input : [input];
        output = arr.map((item) => {
          if (!expr) return item;
          // Simple field path: `item.name`, `item.data.value`
          const parts = expr.replace(/^item\.?/, "").split(".").filter(Boolean);
          let current: unknown = item;
          for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            current = (current as Record<string, unknown>)[part];
          }
          return current;
        });
        break;
      }
      case "filter": {
        const arr = Array.isArray(input) ? input : [input];
        output = arr.filter((item) => {
          if (!expr) return Boolean(item);
          // Evaluate a simple truthy check on the path
          const parts = expr.replace(/^item\.?/, "").split(".").filter(Boolean);
          let current: unknown = item;
          for (const part of parts) {
            if (current === null || current === undefined) return false;
            current = (current as Record<string, unknown>)[part];
          }
          return Boolean(current);
        });
        break;
      }
      case "merge": {
        if (Array.isArray(input)) {
          output = Object.assign({}, ...input.map((item) => (typeof item === "object" && item !== null ? item : { value: item })));
        } else {
          output = input;
        }
        break;
      }
      case "flatten": {
        output = Array.isArray(input) ? input.flat() : [input];
        break;
      }
      case "sort": {
        const arr = Array.isArray(input) ? [...input] : [input];
        arr.sort((a, b) => {
          const aVal = expr ? resolveFieldPath(a, expr) : a;
          const bVal = expr ? resolveFieldPath(b, expr) : b;
          if (typeof aVal === "number" && typeof bVal === "number") return aVal - bVal;
          return String(aVal ?? "").localeCompare(String(bVal ?? ""));
        });
        output = arr;
        break;
      }
      case "dedupe": {
        const arr = Array.isArray(input) ? input : [input];
        if (expr) {
          const seen = new Set<string>();
          output = arr.filter((item) => {
            const val = resolveFieldPath(item, expr);
            const key = JSON.stringify(val);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        } else {
          output = [...new Set(arr.map((x) => JSON.stringify(x)))].map((x) => JSON.parse(x));
        }
        break;
      }
      case "pick": {
        const fields = (expr ?? "").split(",").map((f) => f.trim()).filter(Boolean);
        if (typeof input === "object" && input !== null && !Array.isArray(input)) {
          const result: Record<string, unknown> = {};
          for (const field of fields) {
            if (field in (input as Record<string, unknown>)) {
              result[field] = (input as Record<string, unknown>)[field];
            }
          }
          output = result;
        } else {
          output = input;
        }
        break;
      }
      case "omit": {
        const fields = (expr ?? "").split(",").map((f) => f.trim()).filter(Boolean);
        if (typeof input === "object" && input !== null && !Array.isArray(input)) {
          const result: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
            if (!fields.includes(k)) result[k] = v;
          }
          output = result;
        } else {
          output = input;
        }
        break;
      }
      case "template": {
        // Template string interpolation using `{{ input }}` / `{{ results.x }}`
        output = resolveTemplate(expr, ctx);
        break;
      }
      default:
        output = input;
    }

    ctx.results[node.id] = output;
    await this.persistStep(ctx, node, "SUCCESS", { op, expr: expr.slice(0, 80), output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `${op} → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Delay node — pauses execution for a specified duration. */
  private async runDelayNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    let delayMs = data.delayMs ?? 1000;

    // Support template-based delay: `{{ input.delay }}`
    if (data.delayTemplate) {
      const resolved = resolveTemplate(data.delayTemplate, ctx);
      const parsed = typeof resolved === "number" ? resolved : parseInt(String(resolved), 10);
      if (!isNaN(parsed) && parsed > 0) delayMs = parsed;
    }

    // Cap at 30 seconds to prevent runaway delays
    delayMs = Math.min(delayMs, 30_000);

    ctx.results[node.id] = { delayMs, waited: true };
    if (ctx.signal?.aborted) {
      throw new ExecutionCancelledError("Execution cancelled");
    }
    await new Promise<void>((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;
      const onAbort = () => {
        if (timer) clearTimeout(timer);
        reject(new ExecutionCancelledError("Execution cancelled"));
      };
      if (ctx.signal) {
        ctx.signal.addEventListener("abort", onAbort, { once: true });
      }
      timer = setTimeout(() => {
        if (ctx.signal) {
          ctx.signal.removeEventListener("abort", onAbort);
        }
        resolve();
      }, delayMs);
    });
    await this.persistStep(ctx, node, "SUCCESS", { delayMs });
    this.emitNodeEnd(ctx, node, "SUCCESS", `waited ${delayMs}ms`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Aggregate node — combines results from multiple incoming branches. */
  private async runAggregateNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const mode = data.aggregateMode ?? "concat";

    // Collect results from all incoming edge source nodes
    const incomingEdges = ctx.graph.edges.filter((e) => e.target === node.id);
    const branchResults: unknown[] = incomingEdges.map((e) => ctx.results[e.source]).filter((r) => r !== undefined);

    let output: unknown;

    switch (mode) {
      case "concat": {
        output = branchResults.flat();
        break;
      }
      case "merge": {
        output = Object.assign({}, ...branchResults.map((r) => (typeof r === "object" && r !== null ? r : { value: r })));
        break;
      }
      case "count": {
        output = { count: branchResults.length, items: branchResults };
        break;
      }
      case "first": {
        output = branchResults[0] ?? null;
        break;
      }
      case "all": {
        output = branchResults;
        break;
      }
      case "custom": {
        // Custom aggregation expression — evaluate as a template
        if (data.aggregateExpr) {
          output = resolveTemplate(data.aggregateExpr, { ...ctx, results: { ...ctx.results, __aggregate: branchResults } });
        } else {
          output = branchResults;
        }
        break;
      }
      default:
        output = branchResults;
    }

    ctx.results[node.id] = output;
    await this.persistStep(ctx, node, "SUCCESS", { mode, branchCount: incomingEdges.length, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `${mode} (${incomingEdges.length} branches) → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Variable node — gets or sets a workflow variable in the execution state. */
  private async runVariableNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const varName = data.varName ?? "";
    const op = data.varOp ?? "get";

    if (!varName) {
      throw new ExecutionError(`Variable node "${data.label}" has no variable name configured`, "GRAPH_FAILURE");
    }

    let output: unknown;
    if (op === "set") {
      const value = resolveTemplate(data.varValue, ctx);
      // Store in results under a `vars` namespace
      if (!ctx.results.__vars) ctx.results.__vars = {};
      (ctx.results.__vars as Record<string, unknown>)[varName] = value;
      ctx.results[node.id] = { varName, op: "set", value };
      output = { set: varName, value };
    } else {
      // get
      const vars = (ctx.results.__vars as Record<string, unknown>) ?? {};
      output = vars[varName];
      ctx.results[node.id] = output;
    }

    await this.persistStep(ctx, node, "SUCCESS", { varName, op, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `${op} ${varName} → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Output node — formats and returns the final output with field mappings. */
  private async runOutputNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    let output: unknown;

    if (data.outputFields && Object.keys(data.outputFields).length > 0) {
      // Field mapping mode: map each output field to a resolved template
      const result: Record<string, unknown> = {};
      for (const [key, template] of Object.entries(data.outputFields)) {
        result[key] = resolveTemplate(template, ctx);
      }
      output = result;
    } else if (data.outputTemplate) {
      // Template mode: resolve the template string
      output = resolveTemplate(data.outputTemplate, ctx);
    } else {
      // Default: pass through all results
      output = ctx.results;
    }

    ctx.results[node.id] = output;
    await this.persistStep(ctx, node, "SUCCESS", { output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `output → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Schedule Trigger node — recurrent cron or timer trigger. */
  private async runScheduleTriggerNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const output = {
      trigger: "cron",
      cronExpression: data.cronExpression ?? "0 9 * * *",
      cronTimezone: data.cronTimezone ?? "UTC",
      scheduleInterval: data.scheduleInterval ?? "Recurrent execution",
      triggeredAt: new Date().toISOString(),
      input: ctx.userInput,
    };
    ctx.results[node.id] = output;
    await this.persistStep(ctx, node, "SUCCESS", { trigger: "cron", cron: output.cronExpression });
    this.emitNodeEnd(ctx, node, "SUCCESS", `cron: ${output.cronExpression}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Webhook Trigger node — inbound event listener. */
  private async runWebhookTriggerNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const output = {
      trigger: "webhook",
      path: data.webhookPath ?? "/api/webhooks/incoming",
      method: data.webhookMethod ?? "POST",
      receivedAt: new Date().toISOString(),
      payload: ctx.userInput,
    };
    ctx.results[node.id] = output;
    await this.persistStep(ctx, node, "SUCCESS", { trigger: "webhook", path: output.path });
    this.emitNodeEnd(ctx, node, "SUCCESS", `inbound: ${output.path}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** RSS / Atom Feed node — parses RSS & Atom XML feeds for autonomous ingestion. */
  private async runRssFeedNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const rawUrl = data.rssUrl ?? "https://news.ycombinator.com/rss";
    const resolvedUrl = String(resolveTemplate(rawUrl, ctx) || rawUrl);
    const maxItems = typeof data.rssMaxItems === "number" ? data.rssMaxItems : 10;

    this.emit(ctx, {
      type: "tool:call:start",
      nodeId: node.id,
      toolName: "rss_feed",
      action: "fetch",
      input: { url: resolvedUrl, maxItems },
    });

    const started = Date.now();
    let output: unknown;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(resolvedUrl, {
        headers: {
          "User-Agent": "AgentStudio-FeedPoller/1.0",
          Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml, */*",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new ExecutionError(`RSS fetch failed with status ${res.status}: ${res.statusText}`, "GRAPH_FAILURE");
      }

      const xmlText = await res.text();
      const items = parseRssOrAtomXml(xmlText, maxItems);

      output = {
        feedUrl: resolvedUrl,
        itemCount: items.length,
        items,
      };

      const durationMs = Date.now() - started;
      this.emit(ctx, {
        type: "tool:call:end",
        nodeId: node.id,
        toolName: "rss_feed",
        status: "SUCCESS",
        output,
        durationMs,
      });

      const record: ToolCallRecord = {
        stepNumber: ctx.stepCounter,
        toolName: "rss_feed",
        action: "fetch",
        input: { url: resolvedUrl, maxItems },
        status: "SUCCESS",
        output,
        requiresApproval: false,
        durationMs,
      };
      ctx.toolCalls.push(record);
      ctx.results[node.id] = output;

      if (!ctx.dryRun) {
        await this.deps.executionRepo.addToolCall(ctx.executionId, {
          toolName: "rss_feed",
          action: "fetch",
          inputArgs: { url: resolvedUrl, maxItems },
          outputResult: (output as Record<string, unknown> | undefined) ?? undefined,
          status: "SUCCESS",
          durationMs,
        });
      }
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, {
        type: "tool:call:end",
        nodeId: node.id,
        toolName: "rss_feed",
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });
      throw error;
    }

    await this.persistStep(ctx, node, "SUCCESS", { rssUrl: resolvedUrl, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `RSS ${resolvedUrl.slice(0, 40)} → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Web Reader node — converts any live web URL to clean LLM markdown using Jina Reader. */
  private async runWebReaderNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const rawUrl = data.readerUrl ?? "";
    const targetUrl = String(resolveTemplate(rawUrl, ctx) || rawUrl).trim();
    if (!targetUrl) {
      throw new ExecutionError(`Web Reader node "${data.label}" has no target URL configured`, "GRAPH_FAILURE");
    }

    const jinaUrl = targetUrl.startsWith("https://r.jina.ai/")
      ? targetUrl
      : `https://r.jina.ai/${targetUrl.replace(/^https?:\/\//, "https://")}`;

    const format = data.readerFormat ?? "markdown";
    const headers: Record<string, string> = {
      Accept: "text/markdown, text/plain, */*",
      "X-Return-Format": format,
    };
    if (data.readerTargetSelector) {
      headers["X-Target-Selector"] = data.readerTargetSelector;
    }

    this.emit(ctx, {
      type: "tool:call:start",
      nodeId: node.id,
      toolName: "web_reader",
      action: "jina_reader",
      input: { targetUrl, format },
    });

    const started = Date.now();
    let output: unknown;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      const res = await fetch(jinaUrl, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new ExecutionError(`Jina Reader fetch failed for ${targetUrl} with status ${res.status}`, "GRAPH_FAILURE");
      }

      const text = await res.text();
      const truncatedMarkdown = text.length > 60_000 ? `${text.slice(0, 60_000)}\n\n[...Truncated for token budget]` : text;

      output = {
        url: targetUrl,
        format,
        length: text.length,
        markdown: truncatedMarkdown,
      };

      const durationMs = Date.now() - started;
      this.emit(ctx, {
        type: "tool:call:end",
        nodeId: node.id,
        toolName: "web_reader",
        status: "SUCCESS",
        output,
        durationMs,
      });

      const record: ToolCallRecord = {
        stepNumber: ctx.stepCounter,
        toolName: "web_reader",
        action: "jina_reader",
        input: { targetUrl, format },
        status: "SUCCESS",
        output,
        requiresApproval: false,
        durationMs,
      };
      ctx.toolCalls.push(record);
      ctx.results[node.id] = output;

      if (!ctx.dryRun) {
        await this.deps.executionRepo.addToolCall(ctx.executionId, {
          toolName: "web_reader",
          action: "jina_reader",
          inputArgs: { targetUrl, format },
          outputResult: { url: targetUrl, length: text.length, snippet: truncatedMarkdown.slice(0, 200) },
          status: "SUCCESS",
          durationMs,
        });
      }
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, {
        type: "tool:call:end",
        nodeId: node.id,
        toolName: "web_reader",
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });
      throw error;
    }

    await this.persistStep(ctx, node, "SUCCESS", { readerUrl: targetUrl, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `Jina ${targetUrl.slice(0, 40)} → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Notification Dispatcher node — sends alert/message to Discord, Slack, Telegram, or Webhooks. */
  private async runNotificationDispatcherNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const dest = data.dispatchDestination ?? "discord";
    const rawMessage = data.dispatchMessage ?? "{{ results }}";
    const message = String(resolveTemplate(rawMessage, ctx) || rawMessage);

    let output: unknown;
    const started = Date.now();

    this.emit(ctx, {
      type: "tool:call:start",
      nodeId: node.id,
      toolName: `notify:${dest}`,
      action: "dispatch",
      input: { destination: dest, message: message.slice(0, 100) },
    });

    if (ctx.dryRun) {
      output = {
        dispatched: true,
        dryRun: true,
        destination: dest,
        preview: message.slice(0, 160),
      };
    } else {
      try {
        if (dest === "discord") {
          const webhookUrl = data.dispatchWebhookUrl;
          if (webhookUrl && webhookUrl.startsWith("http")) {
            await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: message.slice(0, 1950) }),
            });
          }
          output = { destination: "discord", dispatched: Boolean(webhookUrl), status: "DELIVERED" };
        } else if (dest === "slack") {
          const webhookUrl = data.dispatchWebhookUrl;
          if (webhookUrl && webhookUrl.startsWith("http")) {
            await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: message }),
            });
          }
          output = { destination: "slack", dispatched: Boolean(webhookUrl), status: "DELIVERED" };
        } else if (dest === "telegram") {
          const botToken = data.telegramBotToken;
          const chatId = data.telegramChatId;
          if (botToken && chatId) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: message.slice(0, 4000),
                parse_mode: "Markdown",
              }),
            });
          }
          output = { destination: "telegram", dispatched: Boolean(botToken && chatId), status: "DELIVERED" };
        } else {
          // Generic webhook
          const webhookUrl = data.dispatchWebhookUrl;
          if (webhookUrl && webhookUrl.startsWith("http")) {
            await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "agent_studio_dispatch",
                message,
                results: ctx.results,
                timestamp: new Date().toISOString(),
              }),
            });
          }
          output = { destination: "webhook", dispatched: Boolean(webhookUrl), status: "DELIVERED" };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        output = { destination: dest, dispatched: false, error: errorMsg };
      }
    }

    const durationMs = Date.now() - started;
    this.emit(ctx, {
      type: "tool:call:end",
      nodeId: node.id,
      toolName: `notify:${dest}`,
      status: "SUCCESS",
      output,
      durationMs,
    });

    ctx.results[node.id] = output;
    await this.persistStep(ctx, node, "SUCCESS", { destination: dest, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `dispatch:${dest} → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Data Mapper node — shapes and extracts fields with JSONPath / dot-paths. */
  private async runDataMapperNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const incomingEdges = ctx.graph.edges.filter((e) => e.target === node.id);
    const sourceNodeId = incomingEdges[0]?.source;
    const inputData = sourceNodeId ? ctx.results[sourceNodeId] : ctx.results;

    let output: unknown;

    if (data.mapperSchema && Object.keys(data.mapperSchema).length > 0) {
      if (Array.isArray(inputData)) {
        output = inputData.map((item) => {
          const mapped: Record<string, unknown> = {};
          for (const [targetKey, sourcePath] of Object.entries(data.mapperSchema ?? {})) {
            mapped[targetKey] = resolveFieldPath(item, sourcePath.replace(/^item\./, ""));
          }
          return mapped;
        });
      } else if (inputData && typeof inputData === "object") {
        const mapped: Record<string, unknown> = {};
        for (const [targetKey, sourcePath] of Object.entries(data.mapperSchema)) {
          mapped[targetKey] = resolveFieldPath(inputData, sourcePath) ?? resolveTemplate(sourcePath, ctx);
        }
        output = mapped;
      } else {
        output = inputData;
      }
    } else if (data.mapperExpression) {
      output = resolveFieldPath(inputData, data.mapperExpression) ?? resolveTemplate(data.mapperExpression, ctx);
    } else {
      output = inputData;
    }

    ctx.results[node.id] = output;
    await this.persistStep(ctx, node, "SUCCESS", { output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `mapper → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** SearXNG Metasearch node — queries open-source metasearch endpoint. */
  private async runSearxngNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const rawQuery = data.searxngQuery ?? "";
    const query = String(resolveTemplate(rawQuery, ctx) || rawQuery).trim();
    if (!query) {
      throw new ExecutionError(`SearXNG node "${data.label}" has no search query configured`, "GRAPH_FAILURE");
    }

    const host = (data.searxngHost || "https://searx.be").replace(/\/+$/, "");
    const limit = typeof data.searxngLimit === "number" ? data.searxngLimit : 5;
    const categories = Array.isArray(data.searxngCategories) && data.searxngCategories.length > 0
      ? data.searxngCategories.join(",")
      : "general";

    const searchUrl = `${host}/search?q=${encodeURIComponent(query)}&format=json&categories=${encodeURIComponent(categories)}`;

    this.emit(ctx, {
      type: "tool:call:start",
      nodeId: node.id,
      toolName: "searxng_search",
      action: "query",
      input: { query, host, limit },
    });

    const started = Date.now();
    let output: unknown;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18_000);
      const res = await fetch(searchUrl, {
        headers: { Accept: "application/json", "User-Agent": "AgentStudio/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`SearXNG query returned ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as { results?: Array<Record<string, unknown>> };
      const rawResults = json.results || [];
      const results = rawResults.slice(0, limit).map((r) => ({
        title: (r.title as string) || "Untitled",
        url: (r.url as string) || "",
        content: (r.content as string) || "",
        score: (r.score as number) || 0,
        publishedDate: (r.publishedDate as string) || null,
        engine: (r.engine as string) || "searxng",
      }));

      output = { query, host, count: results.length, results };
      const durationMs = Date.now() - started;
      this.emit(ctx, {
        type: "tool:call:end",
        nodeId: node.id,
        toolName: "searxng_search",
        status: "SUCCESS",
        output,
        durationMs,
      });

      ctx.results[node.id] = output;
        } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new ExecutionError(`SearXNG search failed against ${host}: ${errMsg}`, "GRAPH_FAILURE");
    }

    await this.persistStep(ctx, node, "SUCCESS", { query, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `SearXNG "${query}" → ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Crawl4AI Scraper node — extracts structured LLM-ready markdown from web pages via Crawl4AI API. */
  private async runCrawl4AiNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const rawUrl = data.crawl4aiUrl ?? "";
    const targetUrl = String(resolveTemplate(rawUrl, ctx) || rawUrl).trim();
    if (!targetUrl) { throw new ExecutionError(`Crawl4AI node "${data.label}" has no target URL configured`, "GRAPH_FAILURE"); }
    const host = (data.crawl4aiHost || "").trim().replace(/\/+$/, "");
    if (!host) { throw new ExecutionError(`Crawl4AI node "${data.label}" has no host configured - set crawl4aiHost (e.g. http://localhost:11235)`, "GRAPH_FAILURE"); }
    const selector = data.crawl4aiSelector || "";
    const wordCountThreshold = typeof data.crawl4aiWordCountThreshold === "number" ? data.crawl4aiWordCountThreshold : 10;
    const started = Date.now();
    this.emit(ctx, { type: "tool:call:start", nodeId: node.id, toolName: "crawl4ai_scrape", action: "crawl", input: { targetUrl, host, selector } });
    let output: unknown;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${host}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [targetUrl], crawler_config: { css_selector: selector || undefined, word_count_threshold: wordCountThreshold } }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { const errText = await res.text().catch(() => ""); throw new ExecutionError(`Crawl4AI returned ${res.status}: ${errText.slice(0, 200)}`, "GRAPH_FAILURE"); }
      const json = await res.json() as Record<string, unknown>;
      const firstResult = Array.isArray(json.results) ? json.results[0] : json;
      const markdown = (firstResult as Record<string, unknown>)?.markdown || json.markdown || "";
      const wordCount = String(markdown).split(/\s+/).filter(Boolean).length;
      output = { url: targetUrl, markdown: String(markdown).slice(0, 80000), wordCount, success: true };
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "crawl4ai_scrape", status: "SUCCESS", output, durationMs });
      ctx.results[node.id] = output;
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "crawl4ai_scrape", status: "FAILED", error: error instanceof Error ? error.message : String(error), durationMs });
      if (error instanceof ExecutionError) throw error;
      throw new ExecutionError(`Crawl4AI crawl failed: ${error instanceof Error ? error.message : String(error)}`, "GRAPH_FAILURE");
    }
    await this.persistStep(ctx, node, "SUCCESS", { targetUrl, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `Crawl4AI ${targetUrl.slice(0, 40)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Docling PDF & Document Parser node — parses documents into Markdown/tables via Docling API. */
  private async runDoclingNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const rawUrl = data.doclingDocumentUrl ?? "";
    const documentUrl = String(resolveTemplate(rawUrl, ctx) || rawUrl).trim();
    if (!documentUrl) { throw new ExecutionError(`Docling node "${data.label}" has no document URL configured`, "GRAPH_FAILURE"); }
    const host = (data.doclingHost || "").trim().replace(/\/+$/, "");
    if (!host) { throw new ExecutionError(`Docling node "${data.label}" has no host - set doclingHost (e.g. http://localhost:5001)`, "GRAPH_FAILURE"); }
    const format = data.doclingOutputFormat ?? "markdown";
    const ocr = data.doclingOcr ?? true;
    const started = Date.now();
    this.emit(ctx, { type: "tool:call:start", nodeId: node.id, toolName: "docling_pdf_parser", action: "parse", input: { documentUrl, format, ocr } });
    let output: unknown;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(`${host}/v1/document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_urls: [documentUrl], to_formats: [format], ocr }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { const errText = await res.text().catch(() => ""); throw new ExecutionError(`Docling returned ${res.status}: ${errText.slice(0, 300)}`, "GRAPH_FAILURE"); }
      const json = await res.json() as Record<string, unknown>;
      const doc = (json.document as Record<string, unknown>) ?? json;
      const markdown = String(doc.markdown_content || doc.md_content || JSON.stringify(doc)).slice(0, 80000);
      const pageCount = Number(doc.page_count || 0);
      const tablesCount = Number(doc.tables_count || 0);
      output = { documentUrl, format, ocr, pageCount, tablesCount, markdown, status: "PARSED" };
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "docling_pdf_parser", status: "SUCCESS", output, durationMs });
      ctx.results[node.id] = output;
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "docling_pdf_parser", status: "FAILED", error: error instanceof Error ? error.message : String(error), durationMs });
      if (error instanceof ExecutionError) throw error;
      throw new ExecutionError(`Docling parse failed: ${error instanceof Error ? error.message : String(error)}`, "GRAPH_FAILURE");
    }
    await this.persistStep(ctx, node, "SUCCESS", { documentUrl, format, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `Docling parsed ${format} -> ${summarize(output)}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Gotenberg PDF Exporter node — renders HTML into PDF via Gotenberg API. */
  private async runGotenbergNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const rawContent = data.gotenbergHtmlContent ?? "<h1>Report</h1>";
    const content = String(resolveTemplate(rawContent, ctx) || rawContent);
    if (!content.trim()) { throw new ExecutionError(`Gotenberg node "${data.label}" has no HTML content`, "GRAPH_FAILURE"); }
    const host = (data.gotenbergHost || "").trim().replace(/\/+$/, "");
    if (!host) { throw new ExecutionError(`Gotenberg node "${data.label}" has no host - set gotenbergHost (e.g. http://localhost:3000)`, "GRAPH_FAILURE"); }
    const paperSize = data.gotenbergPaperSize ?? "A4";
    const landscape = data.gotenbergLandscape ?? false;
    const started = Date.now();
    const fileName = `report-${ctx.executionId}-${Date.now()}.pdf`;
    this.emit(ctx, { type: "tool:call:start", nodeId: node.id, toolName: "gotenberg_pdf_exporter", action: "convert", input: { paperSize, landscape } });
    let output: unknown;
    try {
      const formData = new FormData();
      formData.append("files", new Blob([content], { type: "text/html" }), "index.html");
      const qp = new URLSearchParams({ paperWidth: paperSize === "Letter" ? "8.5" : "21", paperHeight: paperSize === "Letter" ? "11" : "29.7", landscape: String(landscape) });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      const res = await fetch(`${host}/forms/chromium/convert/html?${qp}`, { method: "POST", body: formData, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) { const errText = await res.text().catch(() => ""); throw new ExecutionError(`Gotenberg failed ${res.status}: ${errText.slice(0, 300)}`, "GRAPH_FAILURE"); }
      const pdfBuffer = await res.arrayBuffer();
      const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
      output = { status: "GENERATED", paperSize, orientation: landscape ? "landscape" : "portrait", htmlLength: content.length, fileName, pdfSizeBytes: pdfBuffer.byteLength, pdfBase64: pdfBase64.slice(0, 100000), contentType: res.headers.get("content-type") ?? "application/pdf" };
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "gotenberg_pdf_exporter", status: "SUCCESS", output, durationMs });
      ctx.results[node.id] = output;
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "gotenberg_pdf_exporter", status: "FAILED", error: error instanceof Error ? error.message : String(error), durationMs });
      if (error instanceof ExecutionError) throw error;
      throw new ExecutionError(`Gotenberg PDF failed: ${error instanceof Error ? error.message : String(error)}`, "GRAPH_FAILURE");
    }
    await this.persistStep(ctx, node, "SUCCESS", { paperSize, landscape, fileName, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `PDF Exporter -> ${fileName}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** NocoDB Record node - reads/creates/updates records via NocoDB v2 REST API. */
  private async runNocodbNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const host = (data.nocodbHost || "").trim().replace(/\/+$/, "");
    if (!host) { throw new ExecutionError(`NocoDB node "${data.label}" has no host - set nocodbHost`, "GRAPH_FAILURE"); }
    const apiToken = data.nocodbApiToken || "";
    const tableId = data.nocodbTableId || "";
    const operation = data.nocodbOperation || "create";
    const payload = resolveTemplate(data.nocodbData || {}, ctx) as Record<string, unknown>;
    if (!tableId) { throw new ExecutionError(`NocoDB node "${data.label}" has no table ID`, "GRAPH_FAILURE"); }
    const started = Date.now();
    this.emit(ctx, { type: "tool:call:start", nodeId: node.id, toolName: "nocodb_record", action: operation, input: { host, tableId, operation } });
    let output: unknown;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiToken) headers["xc-token"] = apiToken;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      let res: Response;
      const baseUrl = `${host}/api/v2/tables/${encodeURIComponent(tableId)}/records`;
      switch (operation) {
        case "list": res = await fetch(baseUrl, { method: "GET", headers, signal: controller.signal }); break;
        case "find": { const fp = new URLSearchParams(); if (payload) { for (const [k,v] of Object.entries(payload)) { if (v!=null) fp.set(k,String(v)); } } const qs=fp.toString(); res = await fetch(`${baseUrl}${qs?"?"+qs:""}`, { method: "GET", headers, signal: controller.signal }); break; }
        case "create": res = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal }); break;
        case "update": { const rid = (payload?.Id || payload?.id || payload?.recordId) as string|undefined; const url = rid ? `${baseUrl}/${rid}` : baseUrl; res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(payload), signal: controller.signal }); break; }
        default: clearTimeout(timer); throw new ExecutionError(`NocoDB unknown operation "${operation}"`, "GRAPH_FAILURE");
      }
      clearTimeout(timer);
      if (!res.ok) { const errText = await res.text().catch(() => ""); throw new ExecutionError(`NocoDB ${operation} failed ${res.status}: ${errText.slice(0, 300)}`, "GRAPH_FAILURE"); }
      const json = await res.json();
      output = { tableId, operation, host, records: json.list ?? json.records ?? json, pageInfo: json.pageInfo ?? null, count: Array.isArray(json.list) ? json.list.length : Array.isArray(json) ? json.length : 1, status: "SUCCESS" };
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "nocodb_record", status: "SUCCESS", output, durationMs });
      ctx.results[node.id] = output;
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "nocodb_record", status: "FAILED", error: error instanceof Error ? error.message : String(error), durationMs });
      if (error instanceof ExecutionError) throw error;
      throw new ExecutionError(`NocoDB ${operation} failed: ${error instanceof Error ? error.message : String(error)}`, "GRAPH_FAILURE");
    }
    await this.persistStep(ctx, node, "SUCCESS", { tableId, operation, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `NocoDB [${operation.toUpperCase()}] ${tableId}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** PocketBase Store node - persists data via PocketBase REST API. */
  private async runPocketbaseNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const host = (data.pocketbaseHost || "").trim().replace(/\/+$/, "");
    if (!host) { throw new ExecutionError(`PocketBase node "${data.label}" has no host - set pocketbaseHost`, "GRAPH_FAILURE"); }
    const collection = data.pocketbaseCollection || "agent_state";
    const action = data.pocketbaseAction || "create";
    const payload = resolveTemplate(data.pocketbaseData || {}, ctx) as Record<string, unknown>;
    const authToken = data.pocketbaseAuthToken || "";
    const recordId = data.pocketbaseRecordId || "";
    const started = Date.now();
    this.emit(ctx, { type: "tool:call:start", nodeId: node.id, toolName: "pocketbase_store", action, input: { host, collection, action } });
    let output: unknown;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const cu = `${host}/api/collections/${encodeURIComponent(collection)}/records`;
      let res: Response;
      switch (action) {
        case "list": { const lp = new URLSearchParams(); if (payload) { for (const [k,v] of Object.entries(payload)) { if (v!=null) lp.set(k,String(v)); } } const qs=lp.toString(); res = await fetch(`${cu}${qs?"?"+qs:""}`, { method: "GET", headers, signal: controller.signal }); break; }
        case "get": { const id = recordId || (payload?.id as string) || ""; if (!id) { clearTimeout(timer); throw new ExecutionError("PocketBase get requires a record ID", "GRAPH_FAILURE"); } res = await fetch(`${cu}/${encodeURIComponent(id)}`, { method: "GET", headers, signal: controller.signal }); break; }
        case "create": res = await fetch(cu, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal }); break;
        case "update": { const uid = recordId || (payload?.id as string) || ""; if (!uid) { clearTimeout(timer); throw new ExecutionError("PocketBase update requires a record ID", "GRAPH_FAILURE"); } res = await fetch(`${cu}/${encodeURIComponent(uid)}`, { method: "PATCH", headers, body: JSON.stringify(payload), signal: controller.signal }); break; }
        default: clearTimeout(timer); throw new ExecutionError(`PocketBase unknown action "${action}"`, "GRAPH_FAILURE");
      }
      clearTimeout(timer);
      if (!res.ok) { const errText = await res.text().catch(() => ""); throw new ExecutionError(`PocketBase ${action} failed ${res.status}: ${errText.slice(0, 300)}`, "GRAPH_FAILURE"); }
      const json = await res.json();
      output = { collection, action, host, record: json.record ?? json, page: json.page ?? undefined, totalItems: json.totalItems ?? undefined, status: "PERSISTED" };
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "pocketbase_store", status: "SUCCESS", output, durationMs });
      ctx.results[node.id] = output;
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "pocketbase_store", status: "FAILED", error: error instanceof Error ? error.message : String(error), durationMs });
      if (error instanceof ExecutionError) throw error;
      throw new ExecutionError(`PocketBase ${action} failed: ${error instanceof Error ? error.message : String(error)}`, "GRAPH_FAILURE");
    }
    await this.persistStep(ctx, node, "SUCCESS", { collection, action, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `PocketBase [${action.toUpperCase()}] ${collection}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Qdrant Vector Memory node - search/upsert/count via Qdrant REST API. */
  private async runQdrantNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const host = (data.qdrantHost || "").trim().replace(/\/+$/, "");
    const collection = data.qdrantCollection || "knowledge_base";
    const action = data.qdrantAction || "search";
    const rawQuery = data.qdrantQuery ?? "";
    const query = String(resolveTemplate(rawQuery, ctx) || rawQuery);
    const topK = typeof data.qdrantTopK === "number" ? data.qdrantTopK : 3;
    const apiKey = data.qdrantApiKey || "";
    const started = Date.now();
    this.emit(ctx, { type: "tool:call:start", nodeId: node.id, toolName: "qdrant_vector_memory", action, input: { collection, query: query.slice(0,100), topK } });
    let output: unknown;
    try {
      if (host) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) headers["api-key"] = apiKey;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const base = `${host}/collections/${encodeURIComponent(collection)}/points`;
        let res: Response;
        switch (action) {
          case "search": res = await fetch(`${host}/collections/${encodeURIComponent(collection)}/points/scroll`, { method: "POST", headers, body: JSON.stringify({ limit: topK, with_payload: true, with_vector: false, filter: query ? { must: [{ key: "text", match: { text: query } }] } : undefined }), signal: controller.signal }); break;
          case "upsert": { const ud = ctx.results[node.id] as Record<string,unknown> ?? {}; const points = (Array.isArray(ud) ? ud : [ud]).map((p:unknown) => { const pt=p as Record<string,unknown>; return { id: pt.id || `pt_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, vector: pt.vector, payload: pt.payload ?? pt }; }); res = await fetch(base, { method: "PUT", headers, body: JSON.stringify({ points }), signal: controller.signal }); break; }
          case "count": res = await fetch(`${host}/collections/${encodeURIComponent(collection)}/points/count`, { method: "GET", headers, signal: controller.signal }); break;
          default: clearTimeout(timer); throw new ExecutionError(`Qdrant unknown action "${action}"`, "GRAPH_FAILURE");
        }
        clearTimeout(timer);
        if (!res.ok) { const errText = await res.text().catch(() => ""); throw new ExecutionError(`Qdrant ${action} failed ${res.status}: ${errText.slice(0, 300)}`, "GRAPH_FAILURE"); }
        const json = await res.json() as Record<string, unknown>;
        if (action === "search") { const pts = (json.result as Array<Record<string,unknown>>) || []; output = { collection, action, query, topK, matches: pts.map(p => ({ id: p.id, score: p.score ?? null, payload: p.payload })), count: pts.length, status: "RECALLED" }; }
        else if (action === "upsert") { output = { collection, action, status: json.status === "completed" ? "UPSERTED" : "PENDING", updateId: json.update_id ?? null }; }
        else if (action === "count") { output = { collection, action, count: (json.result as Record<string,unknown>)?.count ?? json.count ?? 0, status: "COUNTED" }; }
      } else {
        // Native PostgreSQL pgvector execution
        const { pgVectorStore } = await import("@/modules/rag/pgvectorStore");
        if (action === "search") {
          const results = await pgVectorStore.search(query, { collection, limit: topK });
          output = { collection, action, query, topK, matches: results.map(r => ({ id: r.id, score: r.score, payload: { text: r.content, title: r.title, ...r.metadata } })), count: results.length, status: "RECALLED", storage: "pgvector" };
        } else if (action === "upsert") {
          const contentToIngest = query || JSON.stringify(ctx.results[node.id] || ctx.userInput);
          const ingestRes = await pgVectorStore.ingestDocument({ content: contentToIngest, title: `Graph Node ${node.id}`, collection });
          output = { collection, action, status: "UPSERTED", documentId: ingestRes.documentId, chunkCount: ingestRes.chunkCount, storage: "pgvector" };
        } else {
          const stats = await pgVectorStore.getStats(undefined, collection);
          output = { collection, action, count: stats.chunkCount, status: "COUNTED", storage: "pgvector" };
        }
      }
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "qdrant_vector_memory", status: "SUCCESS", output, durationMs });
      ctx.results[node.id] = output;
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "qdrant_vector_memory", status: "FAILED", error: error instanceof Error ? error.message : String(error), durationMs });
      if (error instanceof ExecutionError) throw error;
      throw new ExecutionError(`Vector memory ${action} failed: ${error instanceof Error ? error.message : String(error)}`, "GRAPH_FAILURE");
    }
    await this.persistStep(ctx, node, "SUCCESS", { collection, action, query: query.slice(0,80), output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `Vector Memory [${action.toUpperCase()}] ${collection}`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Faster-Whisper Audio Transcriber node - transcribes audio via Faster-Whisper API. */
  private async runAudioTranscriberNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const rawUrl = data.audioSourceUrl ?? "";
    const audioUrl = String(resolveTemplate(rawUrl, ctx) || rawUrl).trim();
    if (!audioUrl) { throw new ExecutionError(`Audio Transcriber node "${data.label}" has no audio URL`, "GRAPH_FAILURE"); }
    const host = (data.audioTranscriberHost || "").trim().replace(/\/+$/, "");
    if (!host) { throw new ExecutionError(`Audio Transcriber node "${data.label}" has no host - set audioTranscriberHost`, "GRAPH_FAILURE"); }
    const language = data.audioLanguage || "auto";
    const started = Date.now();
    this.emit(ctx, { type: "tool:call:start", nodeId: node.id, toolName: "audio_transcriber", action: "transcribe", input: { audioUrl, language, host } });
    let output: unknown;
    try {
      const ac = new AbortController();
      const at = setTimeout(() => ac.abort(), 30000);
      const ar = await fetch(audioUrl, { signal: ac.signal });
      clearTimeout(at);
      if (!ar.ok) { throw new ExecutionError(`Failed to fetch audio from ${audioUrl}: HTTP ${ar.status}`, "GRAPH_FAILURE"); }
      const ab = await ar.blob();
      const ct = ar.headers.get("content-type") ?? "audio/wav";
      const fd = new FormData();
      fd.append("file", new Blob([await ab.arrayBuffer()], { type: ct }), `audio-${Date.now()}`);
      fd.append("model", "whisper-large-v3-turbo");
      if (language !== "auto") fd.append("language", language);
      fd.append("response_format", "verbose_json");
      const wc = new AbortController();
      const wt = setTimeout(() => wc.abort(), 120000);
      const wr = await fetch(`${host}/v1/audio/transcriptions`, { method: "POST", body: fd, signal: wc.signal });
      clearTimeout(wt);
      if (!wr.ok) { const errText = await wr.text().catch(() => ""); throw new ExecutionError(`Whisper failed ${wr.status}: ${errText.slice(0,300)}`, "GRAPH_FAILURE"); }
      const wj = await wr.json() as Record<string, unknown>;
      output = { audioUrl, language: wj.language ?? language, durationSeconds: wj.duration ?? null, text: String(wj.text || ""), segments: wj.segments ?? null, confidence: wj.language_probability ?? null, status: "TRANSCRIBED" };
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "audio_transcriber", status: "SUCCESS", output, durationMs });
      ctx.results[node.id] = output;
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "audio_transcriber", status: "FAILED", error: error instanceof Error ? error.message : String(error), durationMs });
      if (error instanceof ExecutionError) throw error;
      throw new ExecutionError(`Audio transcription failed: ${error instanceof Error ? error.message : String(error)}`, "GRAPH_FAILURE");
    }
    const preview = String((output as Record<string,unknown>)?.text ?? "").slice(0,60);
    await this.persistStep(ctx, node, "SUCCESS", { audioUrl, language, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `Whisper transcribed -> "${preview}..."`);
    return this.firstSuccessor(outgoing, node);
  }

  /** Piper TTS node - synthesizes text into speech via Piper HTTP API. */
  private async runPiperTtsNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const rawText = data.piperText ?? "";
    const text = String(resolveTemplate(rawText, ctx) || rawText).trim();
    if (!text) { throw new ExecutionError(`Piper TTS node "${data.label}" has no text to synthesize`, "GRAPH_FAILURE"); }
    const host = (data.piperHost || "").trim().replace(/\/+$/, "");
    if (!host) { throw new ExecutionError(`Piper TTS node "${data.label}" has no host - set piperHost (e.g. http://localhost:5000)`, "GRAPH_FAILURE"); }
    const voice = data.piperVoice || "en_US-lessac-medium";
    const started = Date.now();
    this.emit(ctx, { type: "tool:call:start", nodeId: node.id, toolName: "piper_tts", action: "synthesize", input: { text: text.slice(0, 200), voice, host } });
    let output: unknown;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${host}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, format: "wav" }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const ac = new AbortController();
        const at = setTimeout(() => ac.abort(), 30000);
        const ar = await fetch(`${host}/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }), signal: ac.signal });
        clearTimeout(at);
        if (!ar.ok) { const errText = await ar.text().catch(() => ""); throw new ExecutionError(`Piper TTS failed ${ar.status}: ${errText.slice(0,300)}`, "GRAPH_FAILURE"); }
        const audioBuffer = await ar.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString("base64");
        output = { voice, text, textLength: text.length, audioType: ar.headers.get("content-type") ?? "audio/wav", audioBase64: audioBase64.slice(0, 200000), audioSizeBytes: audioBuffer.byteLength, status: "SYNTHESIZED" };
      } else {
        const audioBuffer = await res.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString("base64");
        output = { voice, text, textLength: text.length, audioType: res.headers.get("content-type") ?? "audio/wav", audioBase64: audioBase64.slice(0, 200000), audioSizeBytes: audioBuffer.byteLength, status: "SYNTHESIZED" };
      }
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "piper_tts", status: "SUCCESS", output, durationMs });
      ctx.results[node.id] = output;
    } catch (error) {
      const durationMs = Date.now() - started;
      this.emit(ctx, { type: "tool:call:end", nodeId: node.id, toolName: "piper_tts", status: "FAILED", error: error instanceof Error ? error.message : String(error), durationMs });
      if (error instanceof ExecutionError) throw error;
      throw new ExecutionError(`Piper TTS synthesis failed: ${error instanceof Error ? error.message : String(error)}`, "GRAPH_FAILURE");
    }
    await this.persistStep(ctx, node, "SUCCESS", { voice, textLength: text.length, output: summarize(output) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `Piper Voice (${voice}) - ${text.length} chars`);
    return this.firstSuccessor(outgoing, node);
  }

  /** A2A Delegate node - delegates a structured task payload to a remote Google A2A agent. */
  private async runA2ADelegateNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const rawUrl = data.a2aAgentUrl ?? "http://localhost:3000/api/a2a";
    const agentUrl = String(resolveTemplate(rawUrl, ctx) || rawUrl).trim();
    const capability = data.a2aCapability || "default_task";
    const authToken = data.a2aAuthToken;
    const timeoutMs = data.a2aTimeoutMs || 60_000;

    const payload = {
      capability,
      input: {
        results: { ...ctx.results },
        userInput: ctx.userInput,
        nodeLabel: data.label,
        ...(ctx.item !== undefined ? { item: ctx.item } : {}),
      },
    };

    const taskId = `a2a_${node.id}_${Date.now()}`;
    const started = Date.now();

    this.emit(ctx, {
      type: "a2a:task:delegated",
      nodeId: node.id,
      agentUrl,
      capability,
      taskId,
      status: "DELEGATING",
      inputSummary: `Delegating to ${agentUrl} [${capability}]`,
    });

    let totalTokens = 0;
    const { a2aClientService } = await import("@/services/A2AClientService");

    try {
      const response = await a2aClientService.delegate(agentUrl, payload, {
        authToken,
        timeoutMs,
        signal: ctx.signal,
        onTokenChunk: (chunk: string, isThinking?: boolean) => {
          totalTokens += 1;
          const elapsedSec = Math.max(0.1, (Date.now() - started) / 1000);
          this.emit(ctx, {
            type: "node:token_chunk",
            nodeId: node.id,
            chunk,
            isThinking: Boolean(isThinking),
            totalTokens,
            tokensPerSec: Math.round(totalTokens / elapsedSec),
          });
        },
      });

      const durationMs = Date.now() - started;
      ctx.results[node.id] = response.result;

      this.emit(ctx, {
        type: "a2a:task:delegated",
        nodeId: node.id,
        agentUrl,
        capability,
        taskId,
        status: "COMPLETED",
        resultSummary: summarize(response.result),
        durationMs,
        tokensUsed: response.tokensUsed,
      });

      await this.persistStep(ctx, node, "SUCCESS", { a2aAgentUrl: agentUrl, capability, output: summarize(response.result) });
      this.emitNodeEnd(ctx, node, "SUCCESS", `A2A [${capability}] → ${summarize(response.result)}`);
      return this.firstSuccessor(outgoing, node);
    } catch (error) {
      const durationMs = Date.now() - started;
      const errMsg = error instanceof Error ? error.message : String(error);

      this.emit(ctx, {
        type: "a2a:task:delegated",
        nodeId: node.id,
        agentUrl,
        capability,
        taskId,
        status: "FAILED",
        error: errMsg,
        durationMs,
      });

      if (data.a2aFallbackStrategy === "skip") {
        this.emitNodeEnd(ctx, node, "SKIPPED", "Skipped by A2A fallback");
        return this.firstSuccessor(outgoing, node);
      }

      throw new ExecutionError(`A2A Task Delegation to ${agentUrl} failed: ${errMsg}`, "GRAPH_FAILURE");
    }
  }

  /** A2A Channel node - coordinates multi-agent debate and dialogue turns across agents. */
  private async runA2AChannelNode(ctx: WalkCtx, node: GraphNodeDefinition, outgoing: GraphEdgeDefinition[]) {
    const data = node.data;
    const mode = data.a2aChannelMode || "debate";
    const rawTopic = data.a2aChannelTopic || "Collaborative synthesis of previous multi-agent findings";
    const topic = String(resolveTemplate(rawTopic, ctx) || rawTopic).trim();
    const maxTurns = data.a2aMaxTurns || 2;
    const participants = data.a2aParticipants || [
      { name: "Specialist Proposer", agentUrl: "a2a://proposer", role: "proposer" },
      { name: "Adversarial Critic", agentUrl: "a2a://critic", role: "critic" },
    ];

    const dialogueHistory: Array<{ sender: string; content: string; turn: number; simulatedPersona: boolean }> = [];
    const { a2aClientService } = await import("@/services/A2AClientService");

    // Run multi-agent dialogue turns. A participant with a real http(s) agentUrl is
    // genuinely delegated to over the A2A protocol; one without (e.g. the default
    // placeholder "a2a://proposer") falls back to a locally-run persona so canvas
    // templates keep working without every participant needing a real endpoint —
    // but that fallback is disclosed in dialogueHistory/results, never silently
    // presented as a distinct remote agent.
    for (let turn = 1; turn <= maxTurns; turn++) {
      for (const participant of participants) {
        const turnPrompt = `[Turn #${turn}] As ${participant.name} (${participant.role}), deliberate on topic: "${topic}". Current Context & Findings: ${JSON.stringify(ctx.results)}. Previous exchanges: ${JSON.stringify(dialogueHistory.slice(-2))}`;
        const isRemoteAgent = /^https?:\/\//i.test(participant.agentUrl || "");

        let replyContent: string;
        let isSimulatedPersona = false;

        if (isRemoteAgent) {
          try {
            const response = await a2aClientService.sendMessage(
              participant.agentUrl,
              {
                sender: data.label || "Agent Studio Channel",
                role: "agent",
                turn,
                content: turnPrompt,
                metadata: { channelMode: mode, participantRole: participant.role },
              },
              participant.authToken
            );
            replyContent = response.reply;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            replyContent = `[Remote agent at ${participant.agentUrl} unreachable: ${message}]`;
          }
        } else {
          const llm = ctx.llm;
          const turnOutput = await llm.complete([
            {
              role: "system",
              content: `You are simulating a persona named "${participant.name}" (${participant.role}) in an A2A multi-agent channel (${mode} mode) because no real agent URL was configured for this participant. Provide a concise, rigorous response.`,
            },
            { role: "user", content: turnPrompt },
          ]);
          replyContent = turnOutput.content;
          isSimulatedPersona = true;
        }

        const entry = { sender: participant.name, content: replyContent, turn, simulatedPersona: isSimulatedPersona };
        dialogueHistory.push(entry);

        this.emit(ctx, {
          type: "a2a:message:exchange",
          nodeId: node.id,
          sender: participant.name,
          content: replyContent,
          turn,
          mode,
        });

        this.emit(ctx, {
          type: "node:token_chunk",
          nodeId: node.id,
          chunk: `\n[${participant.name}]: ${replyContent}\n`,
          isThinking: false,
          totalTokens: dialogueHistory.length * 40,
          tokensPerSec: 30,
        });
      }
    }

    const consensus = {
      channelMode: mode,
      topic,
      totalTurns: maxTurns,
      dialogue: dialogueHistory,
      synthesis: dialogueHistory[dialogueHistory.length - 1]?.content || "Dialogue completed.",
    };

    ctx.results[node.id] = consensus;
    await this.persistStep(ctx, node, "SUCCESS", { channelMode: mode, output: summarize(consensus.synthesis) });
    this.emitNodeEnd(ctx, node, "SUCCESS", `A2A Channel [${mode}] → ${dialogueHistory.length} turns`);
    return this.firstSuccessor(outgoing, node);
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

/** Resolve a dotted field path (e.g. `name`, `data.value`) against an object. */
function resolveFieldPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Robust regex-tolerant parser for RSS 2.0 and Atom XML feeds. */
function parseRssOrAtomXml(xml: string, maxItems: number): Array<Record<string, string>> {
  const items: Array<Record<string, string>> = [];
  const cleanXml = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

  // Check if Atom (<entry>) or RSS (<item>)
  const isAtom = /<entry[\s>]/i.test(cleanXml);
  const tagPattern = isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi;
  const matches = cleanXml.match(tagPattern) || [];

  for (const block of matches.slice(0, maxItems)) {
    const extractTag = (tag: string): string => {
      const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return match ? match[1].replace(/<[^>]*>/g, "").trim() : "";
    };

    let link = "";
    const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    if (hrefMatch) {
      link = hrefMatch[1].trim();
    } else {
      link = extractTag("link");
    }

    const title = extractTag("title") || "Untitled";
    const pubDate = extractTag("pubDate") || extractTag("published") || extractTag("updated") || extractTag("dc:date") || new Date().toISOString();
    const description = extractTag("description") || extractTag("summary") || extractTag("content") || "";
    const author = extractTag("author") || extractTag("dc:creator") || "";
    const guid = extractTag("guid") || extractTag("id") || link;

    items.push({
      title,
      link,
      pubDate,
      description: description.slice(0, 500),
      author,
      guid,
    });
  }

  return items;
}

