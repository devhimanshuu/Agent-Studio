"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { GraphNodeType, AgentGraphDefinition } from "@/types/graph";
import { CANVAS_NODE_TYPES } from "./nodeTypes";
import { canvasNodeTypes } from "./CanvasNodes";
import { NodePalette } from "./NodePalette";
import { NodeInspector } from "./NodeInspector";
import { graphToFlow, flowToGraph, createNodeFromType, nextNodeId, nextEdgeId, CanvasNode, CanvasNodeData } from "./graphUtils";
import { useExecutionStream, replayEvents } from "./useExecutionStream";
import { computeLayout } from "./autoLayout";
import { validateGraph } from "./graphValidation";
import { collapseSelection } from "./subgraphUtils";
import { clsx } from "clsx";
import { Workflow, Play, Save, Link2, X, Pause, Radio, Flame, LayoutTemplate, AlertTriangle, GitBranch, Keyboard, Copy, Boxes, CornerUpLeft } from "lucide-react";

const labelClass = "text-[9px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-semibold";

interface AgentGraphCanvasProps {
  graph: AgentGraphDefinition | null | undefined;
  onChange: (graph: AgentGraphDefinition) => void;
  /** Live execution id — when set the canvas enters trace mode. */
  executionId?: string | null;
  /** Trace source: a real execution (default) or a ghost-mode preview. */
  mode?: "execution" | "preview";
  /** Edge ids traversed across past runs of this version — coverage view. */
  coverage?: string[];
  readOnly?: boolean;
  /** Rendered inside the trace panel header (e.g. run control button). */
  traceHeaderExtra?: React.ReactNode;
  /** Called when the user enters/exits subgraph editing (page disables run/save). */
  onSubgraphEdit?: (editing: boolean) => void;
}

function CanvasInner({
  graph,
  onChange,
  executionId,
  mode = "execution",
  coverage,
  readOnly = false,
  traceHeaderExtra,
  onSubgraphEdit,
}: AgentGraphCanvasProps) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = theme !== "light" && resolvedTheme !== "light";

  const initial = useMemo(() => graphToFlow(graph), [graph]);
  const [nodes, setNodes] = useNodesState<CanvasNode>(initial.nodes);
  const [edges, setEdges] = useEdgesState(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState(false);
  const [coverageMode, setCoverageMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [subgraphStack, setSubgraphStack] = useState<{ nodeId: string; label: string; parentNodes: CanvasNode[]; parentEdges: Edge[] }[]>([]);
  const inSubgraph = subgraphStack.length > 0;
  const [canvasTheme, setCanvasTheme] = useState<string | null>(null);
  useEffect(() => {
    setCanvasTheme(window.localStorage.getItem("canvas-theme") ?? "neon");
  }, []);
  const cycleTheme = () => {
    const next = canvasTheme === "neon" ? "graphite" : canvasTheme === "graphite" ? "paper" : "neon";
    setCanvasTheme(next);
    window.localStorage.setItem("canvas-theme", next);
  };
  // Time-scrubber: null = follow the live stream, otherwise event index to replay.
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [scrubPlaying, setScrubPlaying] = useState(false);
  const [scrubSpeed, setScrubSpeed] = useState(1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef<AgentGraphDefinition | null>(null);
  const previewEndpoint = useCallback((id: string) => `/api/canvas/preview/${id}/stream`, []);
  const trace = useExecutionStream(executionId ?? null, mode === "preview" ? { endpoint: previewEndpoint } : undefined);

  const inTraceMode = Boolean(executionId);
  const isPreview = mode === "preview";

  // Emits the current graph back to the parent (page state) — skipped in trace mode.
  const notifyChange = useCallback(
    (nextNodes: CanvasNode[], nextEdges: Edge[]) => {
      if (inTraceMode) return;
      const nextGraph = flowToGraph(nextNodes, nextEdges);
      lastEmittedRef.current = nextGraph;
      onChange(nextGraph);
    },
    [inTraceMode, onChange]
  );

  // Sync external graph changes (e.g. initial fetch or reset) to local React Flow state
  useEffect(() => {
    if (graph && graph !== lastEmittedRef.current) {
      const next = graphToFlow(graph);
      setNodes(next.nodes);
      setEdges(next.edges);
    }
  }, [graph, setNodes, setEdges]);

  // Time-scrub: replay the event prefix; otherwise use the live trace state.
  const totalEvents = trace.events.length;
  const clampedScrubIndex = scrubIndex === null ? totalEvents : Math.min(scrubIndex, totalEvents);
  const replayed = useMemo(
    () => (scrubIndex === null ? null : replayEvents(trace.events.slice(0, clampedScrubIndex))),
    [trace.events, scrubIndex, clampedScrubIndex]
  );
  const effStatuses = replayed?.nodeStatuses ?? trace.nodeStatuses;
  const effDetails = replayed?.nodeDetails ?? trace.nodeDetails;
  const effTraversed = replayed?.traversedEdges ?? trace.traversedEdges;
  const effDurations = replayed?.nodeDurations ?? trace.nodeDurations;
  const effExecutionStatus = replayed?.executionStatus ?? trace.executionStatus;

  // Playback: step through events while playing; stop at the end.
  useEffect(() => {
    if (!scrubPlaying || scrubIndex === null) return;
    if (clampedScrubIndex >= totalEvents) {
      setScrubPlaying(false);
      return;
    }
    const timer = setInterval(() => {
      setScrubIndex((i) => (i === null ? i : Math.min(i + 1, totalEvents)));
    }, 120 / scrubSpeed);
    return () => clearInterval(timer);
  }, [scrubPlaying, scrubSpeed, totalEvents, scrubIndex, clampedScrubIndex]);

  // Write the subgraph being edited back into its parent node (returns to the outer view).
  const writeBackSubgraph = useCallback(() => {
    if (subgraphStack.length === 0) return;
    const entry = subgraphStack[subgraphStack.length - 1];
    const inner = flowToGraph(nodes, edges);
    const parentNodes = entry.parentNodes.map((n) =>
      n.id === entry.nodeId ? { ...n, data: { ...n.data, subgraph: inner } } : n
    );
    setNodes(parentNodes);
    setEdges(entry.parentEdges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSubgraphStack((s) => s.slice(0, -1));
    onSubgraphEdit?.(subgraphStack.length > 1);
    notifyChange(parentNodes, entry.parentEdges);
  }, [subgraphStack, nodes, edges, setNodes, setEdges, notifyChange, onSubgraphEdit]);

  // Enter subgraph editing: load the inner graph onto the canvas.
  const openSubgraph = useCallback(
    (node: CanvasNode) => {
      const inner = node.data.subgraph;
      if (!inner || !Array.isArray(inner.nodes)) return;
      const view = graphToFlow(inner);
      setSubgraphStack((s) => [
        ...s,
        { nodeId: node.id, label: node.data.label || "SUBGRAPH", parentNodes: nodes, parentEdges: edges },
      ]);
      setNodes(view.nodes);
      setEdges(view.edges);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      onSubgraphEdit?.(true);
    },
    [nodes, edges, setNodes, setEdges, onSubgraphEdit]
  );

  // Collapse the current selection into a subgraph (macro) node.
  const handleCollapse = useCallback(() => {
    const selectedIds = new Set(
      nodes.filter((n) => n.selected || n.id === selectedNodeId).map((n) => n.id)
    );
    const innerCount = nodes.filter((n) => selectedIds.has(n.id) && n.type !== "start" && n.type !== "end").length;
    if (innerCount < 2) return;
    const subgraphId = nextNodeId("subgraph", nodes);
    const result = collapseSelection(nodes, edges, selectedIds, subgraphId);
    setNodes(result.nodes);
    setEdges(result.edges);
    setSelectedNodeId(subgraphId);
    setSelectedEdgeId(null);
    notifyChange(result.nodes, result.edges);
  }, [nodes, edges, selectedNodeId, setNodes, setEdges, notifyChange]);

  // Reset the scrubber when a new execution/preview starts.
  useEffect(() => {
    // A run/preview always executes the outer graph — write any in-flight
    // subgraph edits back first so nothing is lost.
    if (executionId && subgraphStack.length > 0) writeBackSubgraph();
    setScrubIndex(null);
    setScrubPlaying(false);
    setHeatmap(false);
    setCoverageMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]);

  const coveredEdges = useMemo(() => new Set(coverage ?? []), [coverage]);

  // Heatmap: average per-node latency scaled by the slowest node.
  const nodeLatencies = useMemo(() => {
    const avg: Record<string, number> = {};
    for (const [id, d] of Object.entries(effDurations)) avg[id] = d.count ? d.total / d.count : 0;
    return avg;
  }, [effDurations]);
  const maxLatency = useMemo(() => Math.max(0, ...Object.values(nodeLatencies)), [nodeLatencies]);

  // Sync trace statuses (+ heatmap) onto node data (read-only trace mode).
  const traceNodes = useMemo(() => {
    if (!inTraceMode) return nodes;
    return nodes.map((n) => {
      const latency = heatmap ? nodeLatencies[n.id] : undefined;
      return {
        ...n,
        data: {
          ...n.data,
          traceStatus: effStatuses[n.id],
          traceDetail: effDetails[n.id],
          heatmapLatency: latency,
          heatmapMax: latency !== undefined ? maxLatency : undefined,
        },
      };
    });
  }, [nodes, inTraceMode, heatmap, effStatuses, effDetails, nodeLatencies, maxLatency]);

  // Animate + highlight edges as they are traversed during a live run.
  const traceEdges = useMemo(() => {
    if (!inTraceMode) return edges;
    return edges.map((e) => {
      const traversed = Boolean(effTraversed[e.id]);
      if (!traversed) return e;
      return {
        ...e,
        animated: true,
        style: { stroke: "#818cf8", strokeWidth: 2, ...(e.style ?? {}) },
      };
    });
  }, [edges, inTraceMode, effTraversed]);

  // Coverage view (edit mode): never-traversed edges render dashed amber.
  const coverageEdges = useMemo(() => {
    if (!coverageMode || inTraceMode) return edges;
    return edges.map((e) =>
      coveredEdges.has(e.id)
        ? { ...e, style: { ...(e.style ?? {}), stroke: "#34d399", strokeWidth: 1.5 } }
        : { ...e, style: { ...(e.style ?? {}), stroke: "#f59e0b", strokeDasharray: "6 4", strokeWidth: 1.5, opacity: 0.85 } }
    );
  }, [edges, coverageMode, inTraceMode, coveredEdges]);

  const displayedEdges = inTraceMode ? traceEdges : coverageMode ? coverageEdges : edges;

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  const onNodeDragStop = useCallback(() => {
    notifyChange(nodes, edges);
  }, [nodes, edges, notifyChange]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (inTraceMode) return;
      setEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            id: nextEdgeId(eds),
            type: "smoothstep",
            label: "",
            animated: false,
            labelStyle: { fontSize: 10, fontFamily: "monospace" },
            labelBgPadding: [4, 2] as [number, number],
            labelBgBorderRadius: 4,
          },
          eds
        );
        notifyChange(nodes, next);
        return next;
      });
    },
    [nodes, setEdges, notifyChange, inTraceMode]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  /** ⌥-click duplicates the node (keyboard-first editing). */
  const duplicateNode = useCallback(
    (node: CanvasNode) => {
      if (inTraceMode) return;
      const clone: CanvasNode = {
        ...node,
        id: nextNodeId((node.type ?? "agent") as GraphNodeType, nodes),
        position: { x: node.position.x + 48, y: node.position.y + 48 },
        selected: true,
        data: { ...node.data, traceStatus: undefined, traceDetail: undefined, heatmapLatency: undefined, heatmapMax: undefined },
      };
      const nextNodes = [...nodes, clone];
      setNodes(nextNodes);
      setSelectedNodeId(clone.id);
      setSelectedEdgeId(null);
      notifyChange(nextNodes, edges);
    },
    [nodes, edges, setNodes, notifyChange, inTraceMode]
  );

  const onDragStart = (event: React.DragEvent, type: GraphNodeType) => {
    event.dataTransfer.setData("application/agent-node-type", type);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (inTraceMode) return;
      event.preventDefault();
      const type = event.dataTransfer.getData("application/agent-node-type") as GraphNodeType;
      if (!type || !CANVAS_NODE_TYPES.some((t) => t.type === type)) return;

      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const position = {
        x: event.clientX - bounds.left - 110,
        y: event.clientY - bounds.top - 60,
      };
      const node = createNodeFromType(type, position, nodes);
      const nextNodes = [...nodes, node];
      setNodes(nextNodes);
      setSelectedNodeId(node.id);
      notifyChange(nextNodes, edges);
    },
    [nodes, edges, setNodes, notifyChange, inTraceMode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  // Idle-time validation — inline warnings before you pay for a run.
  const issues = useMemo(() => validateGraph(graph), [graph]);

  const handleAutoLayout = useCallback(() => {
    const positions = computeLayout(nodes, edges);
    const nextNodes = nodes.map((n, i) => ({ ...n, position: positions[i] ?? n.position }));
    setNodes(nextNodes);
    notifyChange(nextNodes, edges);
  }, [nodes, edges, setNodes, notifyChange]);

  const updateNodeData = useCallback(
    (id: string, patch: Partial<CanvasNodeData>) => {
      const nextNodes = nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
      setNodes(nextNodes);
      notifyChange(nextNodes, edges);
    },
    [nodes, edges, setNodes, notifyChange]
  );

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      const nextEdges = edges.map((e) => (e.id === edgeId ? { ...e, label: label || undefined } : e));
      setEdges(nextEdges);
      notifyChange(nodes, nextEdges);
    },
    [nodes, edges, setEdges, notifyChange]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: CanvasNode[]) => {
      if (inTraceMode) return;
      const deletedIds = new Set(deletedNodes.map((n) => n.id));
      const nextNodes = nodes.filter((n) => !deletedIds.has(n.id));
      const nextEdges = edges.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target));
      setNodes(nextNodes);
      setEdges(nextEdges);
      if (selectedNodeId && deletedIds.has(selectedNodeId)) {
        setSelectedNodeId(null);
      }
      notifyChange(nextNodes, nextEdges);
    },
    [inTraceMode, nodes, edges, selectedNodeId, setNodes, setEdges, notifyChange]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (inTraceMode) return;
      const deletedIds = new Set(deletedEdges.map((e) => e.id));
      const nextEdges = edges.filter((e) => !deletedIds.has(e.id));
      setEdges(nextEdges);
      if (selectedEdgeId && deletedIds.has(selectedEdgeId)) {
        setSelectedEdgeId(null);
      }
      notifyChange(nodes, nextEdges);
    },
    [inTraceMode, nodes, edges, selectedEdgeId, setEdges, notifyChange]
  );

  const deleteSelected = useCallback(() => {
    if (inTraceMode) return;
    if (selectedNodeId) {
      const nextNodes = nodes.filter((n) => n.id !== selectedNodeId);
      const nextEdges = edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId);
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedNodeId(null);
      notifyChange(nextNodes, nextEdges);
    } else if (selectedEdgeId) {
      const nextEdges = edges.filter((e) => e.id !== selectedEdgeId);
      setEdges(nextEdges);
      setSelectedEdgeId(null);
      notifyChange(nodes, nextEdges);
    }
  }, [selectedNodeId, selectedEdgeId, nodes, edges, setNodes, setEdges, notifyChange, inTraceMode]);

  const terminal = effExecutionStatus
    ? ["COMPLETED", "FAILED", "CANCELLED", "STEP_LIMIT_EXCEEDED"].includes(effExecutionStatus)
    : false;

  const toggleScrubPlay = () => {
    if (scrubIndex === null) setScrubIndex(0);
    setScrubPlaying((p) => !p);
  };

  return (
    <div className="flex h-full gap-3 font-mono">
      {/* Left palette */}
      {!readOnly && (
        <div className="w-52 shrink-0 overflow-y-auto rounded border border-slate-200 dark:border-indigo-900/40 bg-white/90 dark:bg-[#0a0a0a]/70 p-3 shadow-sm dark:shadow-none">
          <NodePalette onDragStart={onDragStart} disabled={inTraceMode} />
        </div>
      )}

      {/* Center canvas */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Trace status bar */}
        {inTraceMode && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 text-[10px]">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <span className={clsx("inline-block h-2 w-2 rounded-full", trace.connected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              <span className="font-bold tracking-wider">
                {isPreview ? "GHOST PREVIEW · DRY-RUN" : "LIVE TRACE"} · {effExecutionStatus ?? "CONNECTING…"}
              </span>
              {trace.connected ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">[SSE STREAM]</span> : <span className="text-amber-600 dark:text-amber-400 font-semibold">[RECONNECTING]</span>}
            </div>
            <div className="flex items-center gap-2">{traceHeaderExtra}</div>
          </div>
        )}

        {/* Subgraph breadcrumb */}
        {!inTraceMode && inSubgraph && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-400/50 dark:border-slate-500/50 bg-slate-100 dark:bg-slate-900/60 px-3 py-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-700 dark:text-slate-300">
              <Boxes className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-bold uppercase tracking-widest">Editing macro</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">› {subgraphStack[subgraphStack.length - 1].label}</span>
              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold">(exit to save it back)</span>
            </div>
            <button
              type="button"
              onClick={writeBackSubgraph}
              className="inline-flex items-center gap-1 rounded border border-indigo-400 bg-indigo-600 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white hover:bg-indigo-500 transition-colors cursor-pointer"
            >
              <CornerUpLeft className="h-3 w-3" /> EXIT SUBGRAPH
            </button>
          </div>
        )}

        {/* Validation warnings */}
        {!inTraceMode && !readOnly && issues.length > 0 && (
          <div className="mb-2 rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/30 px-3 py-2 space-y-1 max-h-28 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" /> Graph validation · {issues.filter((i) => i.severity === "error").length} error(s),{" "}
              {issues.filter((i) => i.severity === "warning").length} warning(s)
            </div>
            {issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[9px] leading-tight text-amber-800 dark:text-amber-200/80">
                <span className={clsx("shrink-0 font-bold", issue.severity === "error" ? "text-red-500" : "text-amber-500")}>
                  [{issue.severity.toUpperCase()}]
                </span>
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}

        <div
          ref={wrapperRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className={clsx(
            "relative flex-1 min-h-[480px] rounded border border-slate-200 dark:border-indigo-900/40 overflow-hidden",
            canvasTheme === "paper"
              ? "bg-slate-50"
              : canvasTheme === "graphite"
                ? "bg-[#14161c]"
                : "bg-[#07070d]"
          )}
        >
          <ReactFlow
            nodes={traceNodes}
            edges={displayedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            onNodeClick={(event, node) => {
              if (event.altKey) {
                duplicateNode(node);
                return;
              }
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={onEdgeClick}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }}
            nodeTypes={canvasNodeTypes}
            fitView
            minZoom={0.25}
            maxZoom={1.75}
            snapToGrid
            snapGrid={[12, 12]}
            nodesDraggable={!inTraceMode}
            nodesConnectable={!inTraceMode}
            edgesFocusable={!inTraceMode}
            elementsSelectable={!inTraceMode}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.5}
              color={canvasTheme === "paper" ? "#cbd5e1" : canvasTheme === "graphite" ? "#2a2e3a" : isDark ? "#334155" : "#cbd5e1"}
            />
            <Controls className="!border-slate-200 dark:!border-slate-700 !bg-white dark:!bg-[#0b0b12] !shadow-md dark:!shadow-none [&>button]:!border-slate-200 dark:[&>button]:!border-slate-700 [&>button]:!text-slate-700 dark:[&>button]:!text-slate-300 [&>button]:!bg-white dark:[&>button]:!bg-[#0b0b12] [&>button:hover]:!bg-slate-100 dark:[&>button:hover]:!bg-slate-800" />
            <MiniMap
              pannable
              zoomable
              className="!bg-white dark:!bg-[#0b0b12] !border-slate-200 dark:!border-slate-700 !shadow-md dark:!shadow-none"
              maskColor={isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(241, 245, 249, 0.7)"}
              nodeColor={(n) => {
                const t = n.data?.traceStatus;
                if (t === "RUNNING") return "#818cf8";
                if (t === "SUCCESS") return "#34d399";
                if (t === "FAILED") return "#f87171";
                if (t === "AWAITING_APPROVAL") return "#fbbf24";
                return isDark ? "#334155" : "#cbd5e1";
              }}
            />
          </ReactFlow>

          {/* Shortcut hints + theme (edit mode) */}
          {!inTraceMode && !readOnly && (
            <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowShortcuts((s) => !s)}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0b0b12]/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors shadow-sm cursor-pointer"
                  title="Keyboard shortcuts"
                >
                  <Keyboard className="h-3 w-3" /> SHORTCUTS
                </button>
                {showShortcuts && (
                  <div className="absolute right-0 top-7 z-20 w-64 space-y-1 rounded border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-[#0b0b12]/95 p-2.5 shadow-lg">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">SHORTCUTS</div>
                    {[
                      ["⌥ + click node", "duplicate it"],
                      ["⌫ / Backspace", "delete selection"],
                      ["Ctrl / ⌘ + A", "select all"],
                      ["Drag edge handle", "connect nodes"],
                      ["Scroll", "zoom · drag empty space to pan"],
                    ].map(([key, desc]) => (
                      <div key={key} className="flex items-center justify-between gap-2 text-[9px]">
                        <kbd className="rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-black/50 px-1 py-0.5 font-mono text-slate-700 dark:text-slate-300">{key}</kbd>
                        <span className="text-slate-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={cycleTheme}
                className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0b0b12]/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors shadow-sm cursor-pointer"
                title={`Theme: ${canvasTheme} — click to cycle`}
              >
                <Copy className="h-3 w-3" /> {canvasTheme?.toUpperCase() ?? "THEME"}
              </button>
            </div>
          )}

          {/* Auto-layout + collapse + coverage buttons (edit mode) */}
          {!inTraceMode && !readOnly && nodes.length > 0 && (
            <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAutoLayout}
                className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0b0b12]/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors shadow-sm cursor-pointer"
                title="Arrange nodes in layered columns"
              >
                <LayoutTemplate className="h-3 w-3" /> AUTO LAYOUT
              </button>
              <button
                type="button"
                onClick={handleCollapse}
                disabled={!nodes.some((n) => n.selected || n.id === selectedNodeId)}
                className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0b0b12]/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors shadow-sm cursor-pointer disabled:opacity-40"
                title="Collapse the selection into a reusable subgraph (macro) node"
              >
                <Boxes className="h-3 w-3" /> MACRO
              </button>
              {coverage && coverage.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCoverageMode((c) => !c)}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer",
                    coverageMode
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0b0b12]/95 text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300"
                  )}
                  title="Green = traversed in a past run, dashed amber = never traversed"
                >
                  <GitBranch className="h-3 w-3" /> {coverageMode ? "COVERAGE: ON" : "BRANCH COVERAGE"}
                </button>
              )}
            </div>
          )}

          {/* Empty-state hint */}
          {nodes.length <= 2 && !inTraceMode && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2 font-mono">
                <Workflow className="h-8 w-8 mx-auto text-indigo-500/60 dark:text-indigo-500/50" />
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Drag agent, tool & router nodes from the palette</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-500">Connect them to design your multi-agent architecture</p>
              </div>
            </div>
          )}

          {/* Terminal banner */}
          {terminal && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded border border-emerald-400 dark:border-emerald-500/40 bg-emerald-50/95 dark:bg-emerald-950/80 px-4 py-1.5 text-[10px] font-bold tracking-widest text-emerald-800 dark:text-emerald-300 shadow-md">
              ✓ {isPreview ? "PREVIEW" : "EXECUTION"} {effExecutionStatus}
            </div>
          )}
        </div>

        {/* Time-scrubber */}
        {inTraceMode && trace.events.length > 1 && (
          <div className="mt-2 flex items-center gap-2 rounded border border-slate-200 dark:border-slate-700/60 bg-white/90 dark:bg-black/60 px-2.5 py-1.5">
            <button
              type="button"
              onClick={toggleScrubPlay}
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-indigo-300 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
              title={scrubPlaying ? "Pause replay" : "Replay trace"}
            >
              {scrubPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
            <input
              type="range"
              min={0}
              max={totalEvents}
              value={clampedScrubIndex}
              onChange={(e) => {
                setScrubIndex(Number(e.target.value));
                setScrubPlaying(false);
              }}
              className="flex-1 accent-indigo-500 cursor-pointer"
            />
            <span className="shrink-0 text-[9px] text-slate-600 dark:text-slate-400 tabular-nums">
              {clampedScrubIndex}/{totalEvents}
            </span>
            <select
              value={scrubSpeed}
              onChange={(e) => setScrubSpeed(Number(e.target.value))}
              className="shrink-0 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] px-1 py-0.5 text-[9px] text-slate-700 dark:text-slate-300 cursor-pointer"
              title="Replay speed"
            >
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
              <option value={8}>8×</option>
            </select>
            {scrubIndex !== null && (
              <button
                type="button"
                onClick={() => {
                  setScrubIndex(null);
                  setScrubPlaying(false);
                }}
                className="shrink-0 inline-flex items-center gap-1 rounded border border-emerald-300 dark:border-emerald-500/50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
              >
                <Radio className="h-2.5 w-2.5" /> LIVE
              </button>
            )}
          </div>
        )}

        {/* Live event console */}
        {inTraceMode && trace.events.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 dark:border-slate-700/60 bg-slate-100/90 dark:bg-black/70 p-2 space-y-0.5 font-mono text-[9px]">
            {trace.events.slice(-40).map((ev, i) => {
              const nodeId = "nodeId" in ev ? ev.nodeId : undefined;
              const detail = "detail" in ev ? ev.detail : undefined;
              return (
                <div key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <span className="text-slate-500 dark:text-slate-600 shrink-0">{new Date(ev.at).toLocaleTimeString()}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">{ev.type}</span>
                  {nodeId && <span className="text-slate-800 dark:text-slate-300 truncate">{nodeId}</span>}
                  {detail && <span className="text-slate-500 dark:text-slate-500 truncate">{detail}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right inspector */}
      <div className="w-72 shrink-0 overflow-y-auto rounded border border-slate-200 dark:border-indigo-900/40 bg-white/90 dark:bg-[#0a0a0a]/70 p-3 shadow-sm dark:shadow-none">
        {inTraceMode ? (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-bold">
              {isPreview ? "GHOST PREVIEW" : "LIVE TRACE"}
            </div>
            <p className="text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed">
              {isPreview
                ? "Dry-run against your current input — nothing is persisted and approval gates auto-pass. Predicts the exact path before you commit to a real run."
                : "Canvas is locked while the agent traverses the graph. Nodes pulse while running, glow green on success, amber while awaiting human approval, and red on failure."}
            </p>
            <div className="space-y-1 text-[9px] text-slate-700 dark:text-slate-400">
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" /> RUNNING</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" /> SUCCESS</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" /> AWAITING APPROVAL</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" /> FAILED</div>
            </div>

            {/* Heatmap toggle */}
            <div className="border-t border-slate-200 dark:border-slate-700/60 pt-2">
              <button
                type="button"
                onClick={() => setHeatmap((h) => !h)}
                className={clsx(
                  "inline-flex w-full items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer",
                  heatmap
                    ? "border-orange-400 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300"
                    : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-300"
                )}
              >
                <Flame className="h-3 w-3" /> {heatmap ? "HEATMAP: LATENCY ON" : "SHOW LATENCY HEATMAP"}
              </button>
              {heatmap && maxLatency > 0 && (
                <p className="mt-1 text-[8px] text-slate-500 dark:text-slate-500">
                  Slowest node avg {maxLatency >= 1000 ? `${(maxLatency / 1000).toFixed(1)}s` : `${Math.round(maxLatency)}ms`} · cool = fast, hot = slow
                </p>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700/60 pt-2 space-y-1.5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">STATS</div>
              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400"><span>Events received</span><span className="text-indigo-600 dark:text-indigo-300 font-bold">{trace.events.length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400"><span>Nodes touched</span><span className="text-indigo-600 dark:text-indigo-300 font-bold">{Object.keys(effStatuses).length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400"><span>Status</span><span className="text-emerald-600 dark:text-emerald-300 font-bold">{effExecutionStatus ?? "—"}</span></div>
            </div>
          </div>
        ) : selectedEdge ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-bold flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> EDGE
              </div>
              <button
                type="button"
                onClick={deleteSelected}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 dark:border-red-400/50 text-[9px] font-mono text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" /> REMOVE
              </button>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Branch Label</label>
              <input
                value={typeof selectedEdge.label === "string" ? selectedEdge.label : ""}
                onChange={(e) => updateEdgeLabel(selectedEdge.id, e.target.value)}
                placeholder="e.g. true / false / high / worker / join"
                className="w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] px-2.5 py-1.5 text-[10px] text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-colors shadow-sm"
              />
              <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-tight">
                Router & supervisor nodes pick the outgoing edge whose label matches their decision. Parallel nodes use{" "}
                <code className="text-teal-600 dark:text-teal-400">worker</code>/<code className="text-teal-600 dark:text-teal-400">join</code> and loop nodes use{" "}
                <code className="text-fuchsia-600 dark:text-fuchsia-400">body</code>/<code className="text-fuchsia-600 dark:text-fuchsia-400">exit</code> labels.
              </p>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700/60 pt-2 text-[9px] text-slate-600 dark:text-slate-400 font-mono">
              {selectedEdge.source} → {selectedEdge.target}
            </div>
          </div>
        ) : readOnly ? (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-bold">SNAPSHOT</div>
            <p className="text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Read-only view of the graph and its most recent execution trace.
            </p>
            <div className="border-t border-slate-200 dark:border-slate-700/60 pt-2 space-y-1.5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">GRAPH STATS</div>
              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400"><span>Nodes</span><span className="text-indigo-600 dark:text-indigo-300 font-bold">{nodes.length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400"><span>Edges</span><span className="text-indigo-600 dark:text-indigo-300 font-bold">{edges.length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400"><span>Branches</span><span className="text-indigo-600 dark:text-indigo-300 font-bold">{edges.filter((e) => e.label).length}</span></div>
            </div>
          </div>
        ) : selectedNode ? (
          <NodeInspector
            node={selectedNode}
            onUpdate={(patch) => updateNodeData(selectedNode.id, patch)}
            onDelete={deleteSelected}
            allNodeIds={nodes.map((n) => n.id)}
            onOpenSubgraph={openSubgraph}
          />
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-bold">INSPECTOR</div>
            <p className="text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Select a node to configure its prompt, tools, condition, or loop count. Click an edge to rename the branch
              (router edges pick by label).
            </p>
            <div className="border-t border-slate-200 dark:border-slate-700/60 pt-2 space-y-1.5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">GRAPH STATS</div>
              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400"><span>Nodes</span><span className="text-indigo-600 dark:text-indigo-300 font-bold">{nodes.length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400"><span>Edges</span><span className="text-indigo-600 dark:text-indigo-300 font-bold">{edges.length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400"><span>Branches</span><span className="text-indigo-600 dark:text-indigo-300 font-bold">{edges.filter((e) => e.label).length}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentGraphCanvas(props: AgentGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export type { GraphNodeType, AgentGraphDefinition };
