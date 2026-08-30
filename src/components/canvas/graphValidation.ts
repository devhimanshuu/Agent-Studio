import { AgentGraphDefinition } from "@/types/graph";

interface GraphIssue {
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
  edgeId?: string;
}

/**
 * Idle-time validation of a canvas graph — surfaces structural problems
 * inline (disconnected islands, unreachable END, dead router conditions)
 * before the user pays for a run.
 */
export function validateGraph(graph: AgentGraphDefinition | null | undefined): GraphIssue[] {
  const issues: GraphIssue[] = [];
  if (!graph || graph.nodes.length === 0) {
    issues.push({ severity: "error", message: "Graph is empty — drag in a START and END node." });
    return issues;
  }

  const ids = new Set(graph.nodes.map((n) => n.id));
  const start = graph.nodes.find((n) => n.type === "start");
  const end = graph.nodes.find((n) => n.type === "end");
  const outEdges = new Map<string, { id: string; source: string; target: string; label?: string }[]>();
  const inEdges = new Map<string, { id: string; source: string; target: string }[]>();
  for (const n of graph.nodes) {
    outEdges.set(n.id, []);
    inEdges.set(n.id, []);
  }
  for (const e of graph.edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      issues.push({ severity: "error", message: `Edge ${e.id} connects a missing node (${e.source} → ${e.target}).`, edgeId: e.id });
      continue;
    }
    outEdges.get(e.source)!.push(e);
    inEdges.get(e.target)!.push(e);
  }

  if (!start) {
    issues.push({ severity: "error", message: "No START node — the interpreter will refuse to run this graph." });
  }
  if (!end) {
    issues.push({ severity: "error", message: "No END node — the interpreter will refuse to run this graph." });
  }

  if (start && end) {
    // Reachability from START.
    const reachable = new Set<string>();
    const queue = [start.id];
    reachable.add(start.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const e of outEdges.get(id) ?? []) {
        if (!reachable.has(e.target)) {
          reachable.add(e.target);
          queue.push(e.target);
        }
      }
    }
    for (const n of graph.nodes) {
      if (!reachable.has(n.id)) {
        issues.push({
          severity: "warning",
          message: `"${n.data.label}" is unreachable from START — its branch never executes.`,
          nodeId: n.id,
        });
      }
    }

    // Reverse reachability to END.
    const canFinish = new Set<string>();
    const rqueue = [end.id];
    canFinish.add(end.id);
    while (rqueue.length > 0) {
      const id = rqueue.shift()!;
      for (const e of inEdges.get(id) ?? []) {
        if (!canFinish.has(e.source)) {
          canFinish.add(e.source);
          rqueue.push(e.source);
        }
      }
    }
    for (const n of graph.nodes) {
      if (reachable.has(n.id) && !canFinish.has(n.id)) {
        issues.push({
          severity: "warning",
          message: `"${n.data.label}" can never reach END — the run would dead-end there.`,
          nodeId: n.id,
        });
      }
    }
  }

  // Per-node configuration problems.
  for (const n of graph.nodes) {
    const d = n.data;
    switch (n.type) {
      case "tool":
        if (!d.toolName) {
          issues.push({ severity: "warning", message: `Tool node "${d.label}" has no tool selected.`, nodeId: n.id });
        }
        break;
      case "router":
        if (d.routerMode !== "ai" && !d.condition) {
          issues.push({ severity: "warning", message: `Router "${d.label}" has no condition — it will always take the first edge.`, nodeId: n.id });
        } else if (d.routerMode !== "ai" && d.condition) {
          // Reference a node id that doesn't exist → condition can never match.
          const refs = d.condition.match(/results\.([A-Za-z_][A-Za-z0-9_]*)/g) ?? [];
          for (const ref of refs) {
            const nodeId = ref.slice("results.".length);
            if (!ids.has(nodeId)) {
              issues.push({
                severity: "warning",
                message: `Router "${d.label}" condition references unknown node "${nodeId}" — it can never match.`,
                nodeId: n.id,
              });
            }
          }
        }
        break;
      case "parallel":
        if (d.parallelMode === "map" && !d.mapField) {
          issues.push({ severity: "warning", message: `Parallel node "${d.label}" is in map mode but has no map field.`, nodeId: n.id });
        }
        break;
      case "subgraph":
        if (!d.subgraph || !Array.isArray(d.subgraph.nodes) || d.subgraph.nodes.length === 0) {
          issues.push({ severity: "warning", message: `Macro "${d.label}" is empty — open it and build the inner graph.`, nodeId: n.id });
        } else {
          const innerIds = new Set(d.subgraph.nodes.map((x) => x.id));
          for (const e of d.subgraph.edges) {
            if (!innerIds.has(e.source) || !innerIds.has(e.target)) {
              issues.push({ severity: "error", message: `Macro "${d.label}" has an edge referencing a missing inner node (${e.source} → ${e.target}).`, nodeId: n.id });
            }
          }
          if (d.subgraph.nodes.some((x) => x.type === "approval")) {
            issues.push({
              severity: "error",
              message: `Macro "${d.label}" contains an approval node — the runtime rejects approvals inside subgraphs.`,
              nodeId: n.id,
            });
          }
          // Recurse into nested macros.
          for (const inner of d.subgraph.nodes.filter((x) => x.type === "subgraph")) {
            const innerIssues = validateGraph({
              version: 1,
              nodes: d.subgraph!.nodes,
              edges: d.subgraph!.edges,
            });
            for (const issue of innerIssues) {
              issues.push({ severity: issue.severity, message: `Macro "${d.label}" › ${issue.message}`, nodeId: n.id });
            }
            void inner;
          }
        }
        break;
      case "loop":
        if ((outEdges.get(n.id)?.length ?? 0) === 0) {
          issues.push({ severity: "warning", message: `Loop "${d.label}" has no outgoing edges — it can't iterate or exit.`, nodeId: n.id });
        }
        break;
      case "approval":
        // Approval inside a parallel branch is rejected at runtime — flag early.
        break;
      case "mcp_tool":
        if (!d.mcpToolName) {
          issues.push({ severity: "warning", message: `MCP Tool node "${d.label}" has no tool name selected.`, nodeId: n.id });
        }
        if (!d.mcpToolServer) {
          issues.push({ severity: "warning", message: `MCP Tool node "${d.label}" has no server selected.`, nodeId: n.id });
        }
        break;
      case "http":
        if (!d.httpUrl) {
          issues.push({ severity: "warning", message: `HTTP node "${d.label}" has no URL configured.`, nodeId: n.id });
        }
        break;
      case "variable":
        if (!d.varName) {
          issues.push({ severity: "warning", message: `Variable node "${d.label}" has no variable name.`, nodeId: n.id });
        }
        break;
      case "skill":
        if (!d.skillId) {
          issues.push({ severity: "warning", message: `Skill node "${d.label}" has no skill ID configured.`, nodeId: n.id });
        }
        break;
      default:
        break;
    }
  }

  // Approval nodes downstream of a parallel node (runtime rejects these).
  if (start) {
    const parallelIds = new Set(graph.nodes.filter((n) => n.type === "parallel").map((n) => n.id));
    if (parallelIds.size > 0) {
      for (const n of graph.nodes.filter((x) => x.type === "approval")) {
        // Reached from a parallel node without passing back through its join?
        if (isDownstreamOf(parallelIds, n.id, outEdges)) {
          issues.push({
            severity: "error",
            message: `Approval "${n.data.label}" sits inside a parallel branch — the runtime rejects approvals there.`,
            nodeId: n.id,
          });
        }
      }
    }
  }

  return issues;
}

/** True when `targetId` is reachable from any id in `sources` via out-edges. */
function isDownstreamOf(
  sources: Set<string>,
  targetId: string,
  outEdges: Map<string, { target: string }[]>
): boolean {
  const seen = new Set<string>(sources);
  const queue = [...sources];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const e of outEdges.get(id) ?? []) {
      if (e.target === targetId) return true;
      if (!seen.has(e.target)) {
        seen.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return false;
}
