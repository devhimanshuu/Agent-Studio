import { CanvasNode } from "./graphUtils";

interface LayoutPosition {
  x: number;
  y: number;
}

const LAYER_GAP_X = 260;
const NODE_GAP_Y = 170;
const COMPONENT_GAP_X = 140;
const MARGIN = 60;

/**
 * Layered left-to-right auto-layout (no external deps).
 *
 * Each connected component is laid out independently: BFS from its seed
 * assigns nodes to layers, nodes are stacked vertically within a layer, and
 * components are placed side by side with a horizontal gap.
 */
export function computeLayout(nodes: CanvasNode[], edges: { source: string; target: string }[]): LayoutPosition[] {
  const positions: LayoutPosition[] = new Array(nodes.length);
  const indexById = new Map(nodes.map((n, i) => [n.id, i]));
  const outEdges = new Map<string, string[]>();
  for (const n of nodes) outEdges.set(n.id, []);
  for (const e of edges) {
    if (indexById.has(e.source) && indexById.has(e.target)) {
      outEdges.get(e.source)!.push(e.target);
    }
  }

  const assigned = new Set<string>();
  let componentOffsetX = 0;

  for (const seed of nodes) {
    if (assigned.has(seed.id)) continue;

    // BFS within this component.
    const layers: string[][] = [];
    const queue: string[] = [seed.id];
    const dist = new Map<string, number>([[seed.id, 0]]);
    while (queue.length > 0) {
      const id = queue.shift()!;
      const d = dist.get(id)!;
      (layers[d] ??= []).push(id);
      for (const target of outEdges.get(id) ?? []) {
        if (!dist.has(target)) {
          dist.set(target, d + 1);
          queue.push(target);
        }
      }
    }

    let maxLayer = 0;
    layers.forEach((layerNodes, layerIdx) => {
      maxLayer = Math.max(maxLayer, layerIdx);
      layerNodes.sort();
      layerNodes.forEach((nodeId, i) => {
        const index = indexById.get(nodeId);
        if (index !== undefined) {
          positions[index] = { x: componentOffsetX + MARGIN + layerIdx * LAYER_GAP_X, y: MARGIN + i * NODE_GAP_Y };
          assigned.add(nodeId);
        }
      });
    });

    componentOffsetX += (maxLayer + 1) * LAYER_GAP_X + COMPONENT_GAP_X;
  }

  return positions;
}
