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
  | "parallel";

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
  // loop
  maxIterations?: number;
  // parallel
  parallelMode?: ParallelMode;
  /** For map mode — path to the array to iterate (e.g. `input.items`). */
  mapField?: string;
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
