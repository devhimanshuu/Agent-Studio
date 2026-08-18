import { describe, it, expect } from "vitest";
import { validateGraph } from "@/components/canvas/graphValidation";
import { computeLayout } from "@/components/canvas/autoLayout";
import { diffGraphs } from "@/components/canvas/graphDiff";
import { collapseSelection } from "@/components/canvas/subgraphUtils";
import { AgentGraphDefinition } from "@/types/graph";
import type { CanvasNode } from "@/components/canvas/graphUtils";
import type { Edge } from "@xyflow/react";

function baseGraph(): AgentGraphDefinition {
  return {
    version: 1,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
      { id: "agent_1", type: "agent", position: { x: 0, y: 0 }, data: { label: "RESEARCH" } },
      { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
    ],
    edges: [
      { id: "e1", source: "start", target: "agent_1" },
      { id: "e2", source: "agent_1", target: "end" },
    ],
  };
}

describe("validateGraph", () => {
  it("returns no issues for a valid linear graph", () => {
    expect(validateGraph(baseGraph())).toHaveLength(0);
  });

  it("flags disconnected islands and unreachable nodes", () => {
    const graph = baseGraph();
    graph.nodes.push({ id: "island", type: "agent", position: { x: 0, y: 0 }, data: { label: "LOST" } });
    const issues = validateGraph(graph);
    expect(issues.some((i) => i.nodeId === "island" && i.message.includes("unreachable"))).toBe(true);
  });

  it("flags router conditions referencing unknown nodes", () => {
    const graph = baseGraph();
    graph.nodes.splice(1, 1, {
      id: "router",
      type: "router",
      position: { x: 0, y: 0 },
      data: { label: "ROUTER", routerMode: "deterministic", condition: 'results.missing_node.x == "y"' },
    });
    const issues = validateGraph(graph);
    expect(issues.some((i) => i.message.includes("unknown node"))).toBe(true);
  });

  it("flags approval nodes downstream of a parallel node", () => {
    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
        { id: "parallel", type: "parallel", position: { x: 0, y: 0 }, data: { label: "MAP", parallelMode: "map", mapField: "input.items" } },
        { id: "gate", type: "approval", position: { x: 0, y: 0 }, data: { label: "GATE" } },
        { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "parallel" },
        { id: "e2", source: "parallel", target: "gate", label: "worker" },
        { id: "e3", source: "gate", target: "end" },
      ],
    };
    const issues = validateGraph(graph);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("inside a parallel branch"))).toBe(true);
  });
});

describe("diffGraphs", () => {
  it("detects added, removed and changed nodes plus edge changes", () => {
    const base = baseGraph();
    const current = baseGraph();
    // Change agent_1 prompt, drop the start→agent edge, add a node.
    current.nodes.find((n) => n.id === "agent_1")!.data.prompt = "new prompt";
    current.edges = current.edges.filter((e) => e.id !== "e1");
    current.nodes.push({ id: "extra", type: "tool", position: { x: 0, y: 0 }, data: { label: "TOOL", toolName: "calculator" } });

    const diff = diffGraphs(current, base);
    expect(diff.addedNodes.map((n) => n.id)).toEqual(["extra"]);
    expect(diff.removedEdges).toHaveLength(1);
    expect(diff.changedNodes.map((n) => n.id)).toEqual(["agent_1"]);
    expect(diff.changedNodes[0].fields).toContain("prompt");
  });

  it("returns an empty diff for identical graphs", () => {
    const a = baseGraph();
    const diff = diffGraphs(a, a);
    expect(diff.addedNodes).toHaveLength(0);
    expect(diff.removedNodes).toHaveLength(0);
    expect(diff.changedNodes).toHaveLength(0);
    expect(diff.addedEdges).toHaveLength(0);
    expect(diff.removedEdges).toHaveLength(0);
  });
});

describe("collapseSelection", () => {
  it("builds a macro with typed mappings and rewires boundary edges", () => {
    const nodes: CanvasNode[] = [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "S" } } as CanvasNode,
      { id: "agent_1", type: "agent", position: { x: 100, y: 0 }, data: { label: "A", prompt: "use {{ results.start }}" } } as CanvasNode,
      { id: "tool_1", type: "tool", position: { x: 200, y: 0 }, data: { label: "T", toolName: "calculator", inputTemplate: { a: "{{ results.agent_1 }}" } } } as CanvasNode,
      { id: "end", type: "end", position: { x: 300, y: 0 }, data: { label: "E" } } as CanvasNode,
    ];
    const edges: Edge[] = [
      { id: "e1", source: "start", target: "agent_1" },
      { id: "e2", source: "agent_1", target: "tool_1" },
      { id: "e3", source: "tool_1", target: "end" },
    ];

    // Collapse agent_1 + tool_1 (edges e2 between them, e1/e3 cross the boundary).
    const { nodes: nextNodes, edges: nextEdges, subgraphNode } = collapseSelection(
      nodes,
      edges,
      new Set(["agent_1", "tool_1"]),
      "subgraph_1"
    );

    expect(nextNodes.map((n) => n.id).sort()).toEqual(["end", "start", "subgraph_1"]);
    expect(nextEdges).toHaveLength(2); // start→macro, macro→end
    // Input mapping feeds the inner agent from the outer start result.
    expect(subgraphNode.data.inputMapping).toEqual({ in_start: "{{ results.start }}" });
    // Output mapping projects the inner tool result out.
    expect(subgraphNode.data.outputMapping).toEqual({ tool_1: "results.tool_1" });
    // Inner templates rewritten: agent references input.in_start.
    const inner = subgraphNode.data.subgraph!;
    const innerAgent = inner.nodes.find((n) => n.id === "agent_1")!;
    expect(innerAgent.data.prompt).toContain("{{ input.in_start }}");
    // Inner graph has START/END terminals wired to the selected nodes.
    expect(inner.nodes.some((n) => n.type === "start")).toBe(true);
    expect(inner.nodes.some((n) => n.type === "end")).toBe(true);
    expect(inner.edges.some((e) => e.source === "start" && e.target === "agent_1")).toBe(true);
    expect(inner.edges.some((e) => e.source === "tool_1" && e.target === "end")).toBe(true);
  });
});

describe("computeLayout", () => {
  it("lays a chain out in increasing x with distinct positions", () => {
    const nodes: CanvasNode[] = [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { label: "S" } } as CanvasNode,
      { id: "agent_1", type: "agent", position: { x: 0, y: 0 }, data: { label: "A" } } as CanvasNode,
      { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "E" } } as CanvasNode,
    ];
    const positions = computeLayout(nodes, [
      { source: "start", target: "agent_1" },
      { source: "agent_1", target: "end" },
    ]);
    const pos = new Map(nodes.map((n, i) => [n.id, positions[i]]));
    expect(pos.get("start")!.x).toBeLessThan(pos.get("agent_1")!.x);
    expect(pos.get("agent_1")!.x).toBeLessThan(pos.get("end")!.x);
    const unique = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(unique.size).toBe(3);
  });

  it("separates disconnected components horizontally", () => {
    const nodes: CanvasNode[] = [
      { id: "a", type: "agent", position: { x: 0, y: 0 }, data: { label: "A" } } as CanvasNode,
      { id: "b", type: "agent", position: { x: 0, y: 0 }, data: { label: "B" } } as CanvasNode,
    ];
    const positions = computeLayout(nodes, []);
    // Both are separate components (no edges) — should not overlap.
    expect(positions[0]).toBeDefined();
    expect(positions[1]).toBeDefined();
    const xs = positions.map((p) => p.x);
    expect(Math.abs(xs[0] - xs[1])).toBeGreaterThan(0);
  });
});
