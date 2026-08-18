import type { Edge } from "@xyflow/react";
import { AgentGraphDefinition, GraphEdgeDefinition, GraphNodeDefinition, GraphNodeType } from "@/types/graph";
import { CanvasNode, CanvasNodeData } from "./graphUtils";

export interface CollapseResult {
  nodes: CanvasNode[];
  edges: Edge[];
  subgraphNode: CanvasNode;
}

/** Apply a set of string replacements to every string value in node data (recursively). */
function rewriteNodeData(data: CanvasNodeData, rewrites: Record<string, string>): CanvasNodeData {
  const apply = (value: unknown): unknown => {
    if (typeof value === "string") {
      let out = value;
      for (const [from, to] of Object.entries(rewrites)) out = out.split(from).join(to);
      return out;
    }
    if (Array.isArray(value)) return value.map(apply);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = apply(v);
      return out;
    }
    return value;
  };
  return apply(data) as CanvasNodeData;
}

/**
 * Collapse the selected nodes + edges into a single subgraph (macro) node.
 *
 * - The selection becomes the inner graph, with fresh START/END terminals.
 * - Edges crossing the boundary become typed mappings: incoming edges feed an
 *   inner `input.<key>` variable (rewriting `results.<source>` references),
 *   outgoing edges project inner results back as `results.<subgraphId>.<node>`
 *   (rewriting downstream references).
 */
export function collapseSelection(
  nodes: CanvasNode[],
  edges: Edge[],
  selectedIds: Set<string>,
  subgraphId: string
): CollapseResult {
  // Outer START/END are boundaries — never part of the inner graph.
  const innerCandidates = nodes.filter((n) => selectedIds.has(n.id) && n.type !== "start" && n.type !== "end");
  const innerIds = new Set(innerCandidates.map((n) => n.id));

  const innerEdges = edges.filter((e) => innerIds.has(e.source) && innerIds.has(e.target));
  const incoming = edges.filter((e) => !innerIds.has(e.source) && innerIds.has(e.target));
  const outgoing = edges.filter((e) => innerIds.has(e.source) && !innerIds.has(e.target));

  // Typed inputs: each incoming edge feeds an inner variable named after its source.
  const inputMapping: Record<string, string> = {};
  const inputRewrites: Record<string, string> = {};
  for (const e of incoming) {
    const key = `in_${e.source.replace(/[^A-Za-z0-9_]/g, "_")}`;
    inputMapping[key] = `{{ results.${e.source} }}`;
    inputRewrites[`results.${e.source}`] = `input.${key}`;
  }

  // Typed outputs: inner node results exposed as outer result keys.
  const outputMapping: Record<string, string> = {};
  const outputRewrites: Record<string, string> = {};
  for (const e of outgoing) {
    outputMapping[e.source] = `results.${e.source}`;
    outputRewrites[`results.${e.source}`] = `results.${subgraphId}.${e.source}`;
  }

  const graphNodes: GraphNodeDefinition[] = innerCandidates.map((n) => ({
    id: n.id,
    type: (n.type ?? "agent") as GraphNodeType,
    position: { x: n.position.x, y: n.position.y },
    data: rewriteNodeData(n.data, inputRewrites) as GraphNodeDefinition["data"],
  }));

  const startNode: GraphNodeDefinition = { id: "start", type: "start", position: { x: 40, y: 260 }, data: { label: "START" } };
  const endNode: GraphNodeDefinition = { id: "end", type: "end", position: { x: 720, y: 260 }, data: { label: "END" } };

  const graphEdges: GraphEdgeDefinition[] = [
    ...innerEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: typeof e.label === "string" && e.label ? e.label : undefined })),
    // START → every node with no inner incoming edge.
    ...graphNodes
      .filter((n) => !innerEdges.some((e) => e.target === n.id))
      .map((n) => ({ id: `sub-start-${n.id}`, source: "start", target: n.id })),
    // Every node with no inner outgoing edge → END.
    ...graphNodes
      .filter((n) => !innerEdges.some((e) => e.source === n.id))
      .map((n) => ({ id: `sub-end-${n.id}`, source: n.id, target: "end" })),
  ];

  const inner: AgentGraphDefinition = { version: 1, nodes: [startNode, ...graphNodes, endNode], edges: graphEdges };

  const box = innerCandidates.reduce(
    (acc, n) => ({
      minX: Math.min(acc.minX, n.position.x),
      minY: Math.min(acc.minY, n.position.y),
      maxX: Math.max(acc.maxX, n.position.x),
      maxY: Math.max(acc.maxY, n.position.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  const subgraphNode: CanvasNode = {
    id: subgraphId,
    type: "subgraph",
    position: { x: Math.round((box.minX + box.maxX) / 2 - 110), y: Math.round((box.minY + box.maxY) / 2 - 50) },
    data: {
      label: "SUBGRAPH",
      subgraph: inner,
      inputMapping,
      outputMapping,
    },
  };

  // Outer graph: drop the selection, add the macro, rewire boundary edges.
  const kept = nodes.filter((n) => !selectedIds.has(n.id)).map((n) => ({
    ...n,
    data: rewriteNodeData(n.data, outputRewrites),
  }));
  const keptIds = new Set(kept.map((n) => n.id));
  const nextEdges: Edge[] = [];
  let edgeSeq = 1;
  const nextEdgeId = () => {
    while (nextEdges.some((e) => e.id === `edge_${edgeSeq}`)) edgeSeq += 1;
    return `edge_${edgeSeq++}`;
  };
  for (const e of edges) {
    const sIn = innerIds.has(e.source);
    const tIn = innerIds.has(e.target);
    if (!sIn && !tIn) {
      nextEdges.push(e);
    } else if (sIn && tIn) {
      // inner-inner — dropped with the selection
    } else if (!sIn && tIn && keptIds.has(e.source)) {
      nextEdges.push({ ...e, id: nextEdgeId(), target: subgraphId });
    } else if (sIn && !tIn && keptIds.has(e.target)) {
      nextEdges.push({ ...e, id: nextEdgeId(), source: subgraphId });
    }
  }

  return { nodes: [...kept, subgraphNode], edges: nextEdges, subgraphNode };
}
