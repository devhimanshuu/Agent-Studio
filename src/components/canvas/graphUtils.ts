import type { Node, Edge } from "@xyflow/react";
import { AgentGraphDefinition, GraphNodeDefinition, GraphEdgeDefinition, GraphNodeType, createEmptyGraph } from "@/types/graph";
import { CANVAS_NODE_TYPE_MAP } from "./nodeTypes";

/** Extra client-side state carried on each React Flow node (never persisted). */
export interface CanvasNodeData {
  label: string;
  description?: string;
  prompt?: string;
  allowedTools?: string[];
  toolName?: string;
  action?: string;
  inputTemplate?: Record<string, unknown>;
  routerMode?: "deterministic" | "ai";
  condition?: string;
  routerPrompt?: string;
  approvalReason?: string;
  autoApproveCondition?: string;
  escalateAfterMin?: number;
  maxIterations?: number;
  parallelMode?: "map" | "reduce";
  mapField?: string;
  /** Nested graph executed by a subgraph (macro) node. */
  subgraph?: AgentGraphDefinition;
  /** Maps inner input variable → parent template (`{{ results.x.y }}`). */
  inputMapping?: Record<string, string>;
  /** Maps outer result key → inner result template (`results.<innerNodeId>.<path>`). */
  outputMapping?: Record<string, string>;
  /** Live trace status — only set in trace mode. */
  traceStatus?: "RUNNING" | "SUCCESS" | "FAILED" | "AWAITING_APPROVAL" | "SKIPPED";
  /** Live trace detail message. */
  traceDetail?: string;
  /** Heatmap mode: average latency for this node (ms). */
  heatmapLatency?: number;
  /** Heatmap mode: max average latency across the graph (scale anchor). */
  heatmapMax?: number;
  [key: string]: unknown;
}

export type CanvasNode = Node<CanvasNodeData>;

function nodeDataToGraphData(data: CanvasNodeData): GraphNodeDefinition["data"] {
  return {
    label: data.label ?? "UNNAMED",
    description: data.description,
    prompt: data.prompt,
    allowedTools: data.allowedTools,
    toolName: data.toolName,
    action: data.action,
    inputTemplate: data.inputTemplate,
    routerMode: data.routerMode,
    condition: data.condition,
    routerPrompt: data.routerPrompt,
    approvalReason: data.approvalReason,
    autoApproveCondition: data.autoApproveCondition,
    escalateAfterMin: data.escalateAfterMin,
    maxIterations: data.maxIterations,
    parallelMode: data.parallelMode,
    mapField: data.mapField,
    subgraph: data.subgraph,
    inputMapping: data.inputMapping,
    outputMapping: data.outputMapping,
  };
}

/** Convert a persisted graph definition into React Flow nodes/edges. */
export function graphToFlow(graph: AgentGraphDefinition | null | undefined): { nodes: CanvasNode[]; edges: Edge[] } {
  const g = graph && Array.isArray(graph.nodes) && graph.nodes.length > 0 ? graph : createEmptyGraph();
  const nodes: CanvasNode[] = g.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: { ...n.data, traceStatus: undefined, traceDetail: undefined } as CanvasNodeData,
  }));
  const edges: Edge[] = g.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    type: "smoothstep",
    animated: false,
    labelStyle: { fontSize: 10, fontFamily: "monospace" },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  }));
  return { nodes, edges };
}

/** Convert React Flow nodes/edges into a persisted graph definition. */
export function flowToGraph(nodes: CanvasNode[], edges: Edge[]): AgentGraphDefinition {
  const graphNodes: GraphNodeDefinition[] = nodes.map((n) => ({
    id: n.id,
    type: (n.type ?? "agent") as GraphNodeType,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    data: nodeDataToGraphData(n.data),
  }));
  const graphEdges: GraphEdgeDefinition[] = edges
    .filter((e) => e.source && e.target)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" && e.label.trim() ? e.label.trim() : undefined,
    }));
  return { version: 1, nodes: graphNodes, edges: graphEdges };
}

/** Default width for a node type (used by the auto-layout). */
export function nodeDefaultSize(type: string): { width: number; height: number } {
  switch (type) {
    case "start":
    case "end":
      return { width: 140, height: 52 };
    case "agent":
    case "supervisor":
      return { width: 240, height: 128 };
    case "tool":
      return { width: 220, height: 116 };
    case "router":
      return { width: 220, height: 112 };
    case "approval":
      return { width: 220, height: 104 };
    case "loop":
      return { width: 200, height: 96 };
    case "parallel":
      return { width: 220, height: 104 };
    case "subgraph":
      return { width: 220, height: 100 };
    default:
      return { width: 220, height: 100 };
  }
}

/** Create a fresh node id like `agent_1`, `router_2`, unique within the graph. */
export function nextNodeId(type: GraphNodeType, existing: CanvasNode[]): string {
  const used = new Set(existing.map((n) => n.id));
  let i = 1;
  while (used.has(`${type}_${i}`)) i += 1;
  return `${type}_${i}`;
}

/** Create a fresh edge id. */
export function nextEdgeId(existing: Edge[]): string {
  const used = new Set(existing.map((e) => e.id));
  let i = 1;
  while (used.has(`edge_${i}`)) i += 1;
  return `edge_${i}`;
}

/** Build a new node from a palette type at a canvas position. */
export function createNodeFromType(
  type: GraphNodeType,
  position: { x: number; y: number },
  existing: CanvasNode[]
): CanvasNode {
  const meta = CANVAS_NODE_TYPE_MAP[type];
  const id = nextNodeId(type, existing);
  const { width, height } = nodeDefaultSize(type);
  return {
    id,
    type,
    position,
    data: {
      label: meta.label,
      ...(meta.defaults as Record<string, unknown>),
    } as CanvasNodeData,
    measured: { width, height },
  };
}
