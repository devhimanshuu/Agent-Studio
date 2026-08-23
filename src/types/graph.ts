/**
 * Visual Multi-Agent Graph — the persisted definition of an agent architecture
 * designed on the canvas. A skill version that carries a `graphDefinition`
 * executes through the graph interpreter instead of the linear planner.
 */

export type GraphNodeType =
  | "start"
  | "end"
  | "agent"
  | "supervisor"
  | "tool"
  | "router"
  | "approval"
  | "loop"
  | "parallel"
  | "subgraph"
  | "mcp_server"
  | "mcp_tool"
  | "skill"
  | "http"
  | "transform"
  | "delay"
  | "aggregate"
  | "variable"
  | "output"
  | "sticky_note"
  | "frame";

/** Router node evaluation modes. */
export type RouterMode = "deterministic" | "ai";

/** Parallel (map-reduce) node modes. */
export type ParallelMode = "map" | "reduce";

/** Per-type configuration stored in a node's `data`. */
export interface GraphNodeData {
  label: string;
  /** Short role description shown under the label on the canvas. */
  description?: string;
  // agent / supervisor
  /** System prompt for the LLM agent node. */
  prompt?: string;
  /** Tool names the agent may invoke (resolved to registry tools at runtime). */
  allowedTools?: string[];
  // tool
  toolName?: string;
  action?: string;
  /** Input template — values may reference state via `{{ results.<nodeId>.<path> }}` or `{{ input.<path> }}`. */
  inputTemplate?: Record<string, unknown>;
  // router
  routerMode?: RouterMode;
  /** Deterministic condition expression (e.g. `results.classifier.decision == "high"`). */
  condition?: string;
  /** For AI routing — prompt asking the model to choose one of the outgoing edge labels. */
  routerPrompt?: string;
  // approval
  /** Human-readable approval request reason. */
  approvalReason?: string;
  /** When set, the gate auto-passes if this condition is true (HITL escalation rule). */
  autoApproveCondition?: string;
  /** Minutes before a pending request auto-escalates (expires off the queue). */
  escalateAfterMin?: number;
  // loop
  maxIterations?: number;
  // parallel
  parallelMode?: ParallelMode;
  /** For map mode — path to the array to iterate (e.g. `input.items`). */
  mapField?: string;
  // subgraph
  /** The nested graph executed when this node runs. */
  subgraph?: AgentGraphDefinition;
  /** Maps inner input variable → parent template (`{{ results.x.y }}`, `{{ input.z }}`). */
  inputMapping?: Record<string, string>;
  /** Maps outer result key → inner result template (`results.<innerNodeId>.<path>`). */
  outputMapping?: Record<string, string>;
  // mcp_server
  /** MCP server ID to connect to (from preset or directory). */
  mcpServerId?: string;
  /** MCP server transport type. */
  mcpTransport?: "STDIO" | "SSE";
  /** MCP server endpoint URL or command. */
  mcpEndpoint?: string;
  // mcp_tool
  /** Name of the MCP tool to call. */
  mcpToolName?: string;
  /** MCP server to call the tool from. */
  mcpToolServer?: string;
  /** Input parameters for the MCP tool (JSON template). */
  mcpToolParams?: Record<string, unknown>;
  // skill
  /** Skill ID to execute. */
  skillId?: string;
  /** Skill input data (JSON template). */
  skillInput?: Record<string, unknown>;
  // http
  /** HTTP method. */
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** HTTP endpoint URL (supports template strings). */
  httpUrl?: string;
  /** HTTP request headers (JSON). */
  httpHeaders?: Record<string, string>;
  /** HTTP request body (JSON template). */
  httpBody?: Record<string, unknown>;
  /** Expected response type. */
  httpResponseType?: "json" | "text" | "blob";
  /** Per-request wall-clock budget in ms. Default 30s, capped by the run timeout. */
  httpTimeoutMs?: number;
  // transform
  /** Transform operation type. */
  transformOp?: "map" | "filter" | "merge" | "flatten" | "sort" | "dedupe" | "pick" | "omit" | "template";
  /** Transform expression or field path. */
  transformExpr?: string;
  // delay
  /** Delay duration in milliseconds. */
  delayMs?: number;
  /** Delay duration as a template string (e.g. `{{ input.delay }}`). */
  delayTemplate?: string;
  // aggregate
  /** How to combine results from incoming branches. */
  aggregateMode?: "concat" | "merge" | "count" | "first" | "all" | "custom";
  /** Custom aggregation expression (JS). */
  aggregateExpr?: string;
  // variable
  /** Variable name to get or set. */
  varName?: string;
  /** Operation: get or set. */
  varOp?: "get" | "set";
  /** Value to set (JSON template). */
  varValue?: unknown;
  // output
  /** Output format template. */
  outputTemplate?: string;
  /** Output field mappings. */
  outputFields?: Record<string, string>;
  // sticky_note
  /** Markdown content for the sticky note. */
  noteContent?: string;
  /** Background color for the sticky note. */
  noteColor?: string;
  // frame
  /** Frame title / section label. */
  frameTitle?: string;
  /** Frame background opacity (0-1). */
  frameOpacity?: number;
  /** IDs of nodes contained within this frame (visual grouping). */
  containedNodeIds?: string[];
  // breakpoint
  /** Whether this node has a breakpoint set (debug mode). */
  breakpoint?: boolean;
  // token tracking
  /** Token usage stats for this node during execution. */
  tokenUsage?: { inputTokens?: number; outputTokens?: number; totalCost?: number; model?: string; };
  /** Streaming text token from LLM. */
  streamingText?: string;
  /** Whether this node is currently streaming. */
  isStreaming?: boolean;
}

export interface GraphNodeDefinition {
  id: string;
  type: GraphNodeType;
  position: { x: number; y: number };
  data: GraphNodeData;
}

/** One directed connection between nodes. `label` is the branch condition shown on the edge. */
export interface GraphEdgeDefinition {
  id: string;
  source: string;
  target: string;
  /** Branch label — routers/supervisors pick outgoing edges by label. */
  label?: string;
}

export interface AgentGraphDefinition {
  /** Schema version — currently 1. */
  version: 1;
  nodes: GraphNodeDefinition[];
  edges: GraphEdgeDefinition[];
}

/** Validates a graph has the minimal structure required to execute. */
export function isValidGraph(graph: AgentGraphDefinition | null | undefined): graph is AgentGraphDefinition {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return false;
  if (graph.nodes.length === 0) return false;
  const ids = new Set(graph.nodes.map((n) => n.id));
  const hasStart = graph.nodes.some((n) => n.type === "start");
  const hasEnd = graph.nodes.some((n) => n.type === "end");
  const edgesValid = graph.edges.every((e) => ids.has(e.source) && ids.has(e.target));
  return hasStart && hasEnd && edgesValid;
}

/** Build a minimal executable graph: start -> end. */
export function createEmptyGraph(): AgentGraphDefinition {
  return {
    version: 1,
    nodes: [
      { id: "start", type: "start", position: { x: 40, y: 260 }, data: { label: "START" } },
      { id: "end", type: "end", position: { x: 720, y: 260 }, data: { label: "END" } },
    ],
    edges: [{ id: "start-end", source: "start", target: "end", label: "" }],
  };
}
