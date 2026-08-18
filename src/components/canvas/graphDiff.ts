import { AgentGraphDefinition } from "@/types/graph";

export interface GraphDiff {
  addedNodes: { id: string; label: string; type: string }[];
  removedNodes: { id: string; label: string; type: string }[];
  changedNodes: { id: string; label: string; fields: string[] }[];
  addedEdges: { source: string; target: string; label?: string }[];
  removedEdges: { source: string; target: string; label?: string }[];
}

const NODE_FIELDS = [
  "label",
  "prompt",
  "routerPrompt",
  "toolName",
  "action",
  "inputTemplate",
  "routerMode",
  "condition",
  "approvalReason",
  "autoApproveCondition",
  "escalateAfterMin",
  "maxIterations",
  "parallelMode",
  "mapField",
] as const;

/** Structural + configuration diff between two graph versions. */
export function diffGraphs(current: AgentGraphDefinition, base: AgentGraphDefinition): GraphDiff {
  const diff: GraphDiff = { addedNodes: [], removedNodes: [], changedNodes: [], addedEdges: [], removedEdges: [] };

  const currentById = new Map(current.nodes.map((n) => [n.id, n]));
  const baseById = new Map(base.nodes.map((n) => [n.id, n]));

  for (const n of current.nodes) {
    if (!baseById.has(n.id)) {
      diff.addedNodes.push({ id: n.id, label: n.data.label, type: n.type });
    }
  }
  for (const n of base.nodes) {
    if (!currentById.has(n.id)) {
      diff.removedNodes.push({ id: n.id, label: n.data.label, type: n.type });
    }
  }
  for (const [id, cur] of currentById) {
    const baseNode = baseById.get(id);
    if (!baseNode) continue;
    const changedFields: string[] = [];
    for (const field of NODE_FIELDS) {
      const a = (cur.data as unknown as Record<string, unknown>)[field];
      const b = (baseNode.data as unknown as Record<string, unknown>)[field];
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changedFields.push(field);
    }
    if (cur.type !== baseNode.type) changedFields.push("type");
    if (changedFields.length > 0) {
      diff.changedNodes.push({ id, label: cur.data.label, fields: changedFields });
    }
  }

  // Compare edges by (source → target) since edge ids are regenerated on edit.
  const edgeKey = (source: string, target: string) => `${source}->${target}`;
  const currentEdges = new Map(current.edges.map((e) => [edgeKey(e.source, e.target), e]));
  const baseEdges = new Map(base.edges.map((e) => [edgeKey(e.source, e.target), e]));
  for (const e of current.edges) {
    if (!baseEdges.has(edgeKey(e.source, e.target))) {
      diff.addedEdges.push({ source: e.source, target: e.target, label: e.label });
    }
  }
  for (const e of base.edges) {
    if (!currentEdges.has(edgeKey(e.source, e.target))) {
      diff.removedEdges.push({ source: e.source, target: e.target, label: e.label });
    }
  }

  return diff;
}
