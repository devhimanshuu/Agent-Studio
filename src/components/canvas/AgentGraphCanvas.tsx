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
import { Workflow, Play, Link2, X, Pause, Radio, Flame, LayoutTemplate, AlertTriangle, GitBranch, Keyboard, Copy, Boxes, CornerUpLeft, Maximize, Minimize, Undo2, Redo2, Search, Download, Upload, Package, Bug, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight, ChevronDown, ChevronUp, Check, Network } from "lucide-react";
import { toast } from "@/stores/toastStore";
import { QuickConnectSearch } from "./quickConnectSearch";
import { AlignmentBar } from "./AlignmentBar";
import { CanvasCopilot } from "./CanvasCopilot";
import { ExportDialog } from "./ExportDialog";
import { MacroLibrary } from "./MacroLibrary";
import { DebuggerPanel } from "./DebuggerPanel";
import { CollaborationOverlay } from "./CollaborationOverlay";
import { A2ADirectoryModal } from "./A2ADirectoryModal";
import type { A2AAgentManifest } from "@/types/a2a";
import { clsx } from "clsx";

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
  const [showValidationDetails, setShowValidationDetails] = useState(false);
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
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Quick-Connect Radial Search state
  const [quickConnect, setQuickConnect] = useState<{ position: { x: number; y: number }; sourceNodeId?: string; sourceHandleId?: string } | null>(null);
  const connectSourceIdRef = useRef<string | null>(null);
  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  // Macro library state
  const [showMacroLibrary, setShowMacroLibrary] = useState(false);
  // A2A Agent Directory state
  const [showA2ADirectory, setShowA2ADirectory] = useState(false);
  // Debugger state
  const [showDebugger, setShowDebugger] = useState(false);
  // Collaboration viewport
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const [showNodeSearch, setShowNodeSearch] = useState(false);
  const [nodeSearchQuery, setNodeSearchQuery] = useState("");
  const [clipboard, setClipboard] = useState<{ nodes: CanvasNode[]; edges: Edge[] } | null>(null);
  const [history, setHistory] = useState<{ nodes: CanvasNode[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<{ nodes: CanvasNode[]; edges: Edge[] }[]>([]);
  const historyIndexRef = useRef(-1);
  const duplicateNodeRef = useRef<((node: CanvasNode) => void) | null>(null);
  const [fsLeftOpen, setFsLeftOpen] = useState(true);
  const [fsRightOpen, setFsRightOpen] = useState(true);
  const [normLeftOpen, setNormLeftOpen] = useState(true);
  const [normRightOpen, setNormRightOpen] = useState(true);

  // Responsive sidebar collapse on smaller desktop / tablet screens
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 1024) setNormLeftOpen(false);
      if (window.innerWidth < 1280) setNormRightOpen(false);
    }
  }, []);

  const previewEndpoint = useCallback((id: string) => `/api/canvas/preview/${id}/stream`, []);
  const trace = useExecutionStream(executionId ?? null, mode === "preview" ? { endpoint: previewEndpoint } : undefined);

  const inTraceMode = Boolean(executionId);
  const isPreview = mode === "preview";

  // ─── Full-Screen Mode (overlay, not browser fullscreen API) ───
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  // ─── Undo / Redo History ───
  const pushHistory = useCallback((nds: CanvasNode[], eds: Edge[]) => {
    const entry = { nodes: nds.map((n) => ({ ...n, data: { ...n.data } })), edges: [...eds] };
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(entry);
    // Cap at 50 entries
    if (newHistory.length > 50) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setHistory([...newHistory]);
    setHistoryIndex(historyIndexRef.current);
  }, []);

  // Emits the current graph back to the parent without recording history (used by undo/redo).
  const emitGraphChange = useCallback(
    (nextNodes: CanvasNode[], nextEdges: Edge[]) => {
      if (inTraceMode) return;
      const nextGraph = flowToGraph(nextNodes, nextEdges);
      lastEmittedRef.current = nextGraph;
      onChange(nextGraph);
    },
    [inTraceMode, onChange]
  );

  // Emits graph to parent AND records in history (used by all user modifications).
  const notifyChange = useCallback(
    (nextNodes: CanvasNode[], nextEdges: Edge[]) => {
      if (inTraceMode) return;
      emitGraphChange(nextNodes, nextEdges);
      pushHistory(nextNodes, nextEdges);
    },
    [inTraceMode, emitGraphChange, pushHistory]
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const entry = historyRef.current[historyIndexRef.current];
    setNodes(entry.nodes);
    setEdges(entry.edges);
    setHistoryIndex(historyIndexRef.current);
    emitGraphChange(entry.nodes, entry.edges);
  }, [setNodes, setEdges, emitGraphChange]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const entry = historyRef.current[historyIndexRef.current];
    setNodes(entry.nodes);
    setEdges(entry.edges);
    setHistoryIndex(historyIndexRef.current);
    emitGraphChange(entry.nodes, entry.edges);
  }, [setNodes, setEdges, emitGraphChange]);

  // Sync external graph changes (e.g. initial fetch or reset) to local React Flow state.
  // Do NOT re-sync while in active trace mode to prevent canvas position disturbances.
  useEffect(() => {
    if (inTraceMode) return;
    if (graph && graph !== lastEmittedRef.current) {
      const next = graphToFlow(graph);
      setNodes(next.nodes);
      setEdges(next.edges);
    }
  }, [graph, inTraceMode, setNodes, setEdges]);

  // Initialize history when graph first loads
  useEffect(() => {
    if (graph && historyRef.current.length === 0) {
      const initial = graphToFlow(graph);
      pushHistory(initial.nodes, initial.edges);
    }
  }, [graph, pushHistory]);

  // ─── Copy / Paste Nodes ───
  const copySelection = useCallback(() => {
    const selectedIds = new Set(
      nodes.filter((n) => n.selected || n.id === selectedNodeId).map((n) => n.id)
    );
    if (selectedIds.size === 0) return;
    const copiedNodes = nodes.filter((n) => selectedIds.has(n.id));
    const copiedEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));
    setClipboard({ nodes: copiedNodes, edges: copiedEdges });
    toast.success("Copied to clipboard", `${copiedNodes.length} node(s) copied.`);
  }, [nodes, edges, selectedNodeId]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard || inTraceMode) return;
    const idMap = new Map<string, string>();
    const newNodes = clipboard.nodes.map((n) => {
      const newId = nextNodeId((n.type ?? "agent") as GraphNodeType, [...nodes, ...clipboard.nodes.map((cn) => ({ ...cn, id: cn.id }))]);
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 48, y: n.position.y + 48 },
        selected: true,
        data: { ...n.data, traceStatus: undefined, traceDetail: undefined },
      };
    });
    const currentEdgeList = [...edges];
    const newEdges = clipboard.edges.map((e) => {
      const edgeId = nextEdgeId(currentEdgeList);
      const edgeObj: Edge = {
        ...e,
        id: edgeId,
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
      };
      currentEdgeList.push(edgeObj);
      return edgeObj;
    });
    const allNodes = [...nodes, ...newNodes];
    const allEdges = [...edges, ...newEdges];
    setNodes(allNodes);
    setEdges(allEdges);
    notifyChange(allNodes, allEdges);
  }, [clipboard, nodes, edges, inTraceMode, setNodes, setEdges, notifyChange]);

  // ─── Export / Import Graph ───
  const exportGraph = useCallback(() => {
    const graphData = flowToGraph(nodes, edges);
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-graph-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Graph exported", "JSON file downloaded.");
  }, [nodes, edges]);

  const importGraph = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
            const flow = graphToFlow(data);
            setNodes(flow.nodes);
            setEdges(flow.edges);
            notifyChange(flow.nodes, flow.edges);
            toast.success("Graph imported", `Imported ${flow.nodes.length} nodes and ${flow.edges.length} edges.`);
          } else {
            toast.error("Import failed", "File is missing a valid nodes array.");
          }
        } catch {
          toast.error("Import failed", "Invalid JSON format in selected file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges, notifyChange]);

  // ─── Quick-Connect Radial Search ───
  const handleQuickConnectSelect = useCallback((type: GraphNodeType) => {
    if (!quickConnect) return;
    const node = createNodeFromType(type, quickConnect.position, nodes);
    const nextNodes = [...nodes, node];
    setNodes(nextNodes);
    // Auto-wire: connect source node to the new node
    if (quickConnect.sourceNodeId) {
      const newEdge: Edge = {
        id: nextEdgeId(edges),
        source: quickConnect.sourceNodeId,
        target: node.id,
        type: "smoothstep",
        animated: false,
        labelStyle: { fontSize: 10, fontFamily: "monospace" },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      };
      const nextEdges = [...edges, newEdge];
      setEdges(nextEdges);
      notifyChange(nextNodes, nextEdges);
    } else {
      notifyChange(nextNodes, edges);
    }
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setQuickConnect(null);
  }, [quickConnect, nodes, edges, setNodes, setEdges, notifyChange]);

  // ─── Alignment Bar ───
  const selectedNodesForAlignment = useMemo(
    () => nodes.filter((n) => n.selected),
    [nodes]
  );

  const handleAlignment = useCallback((updatedNodes: CanvasNode[]) => {
    const nextNodes = nodes.map((n) => {
      const updated = updatedNodes.find((u) => u.id === n.id);
      return updated ? { ...n, position: updated.position } : n;
    });
    setNodes(nextNodes);
    notifyChange(nextNodes, edges);
  }, [nodes, edges, setNodes, notifyChange]);

  // ─── Breakpoint Toggle ───
  const handleToggleBreakpoint = useCallback((nodeId: string) => {
    setNodes((prev) => {
      const next = prev.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, breakpoint: !n.data.breakpoint } }
          : n
      );
      notifyChange(next, edges);
      return next;
    });
  }, [edges, setNodes, notifyChange]);

  // ─── Macro Library Handlers ───
  const handleAddMacro = useCallback((macroGraph: AgentGraphDefinition) => {
    const flow = graphToFlow(macroGraph);
    // Offset positions to avoid overlap
    const offset = { x: 200, y: 100 };
    const newNodes = flow.nodes.map((n) => ({
      ...n,
      id: nextNodeId((n.type ?? "agent") as GraphNodeType, [...nodes, ...flow.nodes]),
      position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
      data: { ...n.data, traceStatus: undefined, traceDetail: undefined },
    }));
    const idMap = new Map<string, string>();
    flow.nodes.forEach((orig, i) => idMap.set(orig.id, newNodes[i].id));
    const currentEdgeList = [...edges];
    const newEdges = flow.edges.map((e) => {
      const edgeId = nextEdgeId(currentEdgeList);
      const edgeObj: Edge = {
        ...e,
        id: edgeId,
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
      };
      currentEdgeList.push(edgeObj);
      return edgeObj;
    });
    const allNodes = [...nodes, ...newNodes];
    const allEdges = [...edges, ...newEdges];
    setNodes(allNodes);
    setEdges(allEdges);
    notifyChange(allNodes, allEdges);
    toast.success("Macro added", `Inserted ${newNodes.length} nodes onto the canvas.`);
  }, [nodes, edges, setNodes, setEdges, notifyChange]);

  // ─── A2A Directory: Add Agent onto Canvas ───
  const handleAddA2AAgentFromDirectory = useCallback((manifest: A2AAgentManifest) => {
    const position = { x: 350, y: 240 };
    const newNodeId = nextNodeId("a2a_delegate", nodes);
    const firstCap = manifest.capabilities?.[0]?.id || "deep_research";
    const newNode: CanvasNode = {
      id: newNodeId,
      type: "a2a_delegate",
      position,
      data: {
        label: manifest.displayName || manifest.name.toUpperCase(),
        a2aAgentUrl: manifest.endpoints.tasks,
        a2aCapability: firstCap,
        a2aTimeoutMs: 60000,
        a2aFallbackStrategy: "retry",
      },
    };
    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    setSelectedNodeId(newNode.id);
    notifyChange(nextNodes, edges);
    toast.success("A2A Agent Added", `Added ${manifest.displayName || manifest.name} to the canvas.`);
  }, [nodes, edges, setNodes, notifyChange]);

  // ─── Canvas Copilot: Generate graph from NL prompt ───
  const handleCopilotGraphGenerated = useCallback((generatedGraph: AgentGraphDefinition) => {
    const flow = graphToFlow(generatedGraph);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    notifyChange(flow.nodes, flow.edges);
    toast.success("Graph generated", `Created architecture with ${flow.nodes.length} nodes.`);
  }, [setNodes, setEdges, notifyChange]);

  // ─── Node Search ───
  const filteredNodes = useMemo(() => {
    if (!nodeSearchQuery.trim()) return [];
    const q = nodeSearchQuery.toLowerCase();
    return nodes.filter((n) => {
      const label = (n.data.label ?? "").toLowerCase();
      const type = (n.type ?? "").toLowerCase();
      const prompt = (n.data.prompt ?? "").toLowerCase();
      return label.includes(q) || type.includes(q) || prompt.includes(q);
    });
  }, [nodes, nodeSearchQuery]);

  const focusNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setShowNodeSearch(false);
    setNodeSearchQuery("");
  }, []);

  // ─── Keyboard Shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      // ⌘+Z = undo
      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      // ⌘+Shift+Z = redo
      if (meta && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      // ⌘+Y = redo (alt)
      if (meta && e.key === "y") { e.preventDefault(); redo(); }
      // ⌘+C = copy
      if (meta && e.key === "c" && !window.getSelection()?.toString()) { e.preventDefault(); copySelection(); }
      // ⌘+V = paste
      if (meta && e.key === "v") { e.preventDefault(); pasteClipboard(); }
      // ⌘+D = duplicate selected
      if (meta && e.key === "d") { e.preventDefault(); if (selectedNodeId) { const node = nodes.find((n) => n.id === selectedNodeId); if (node && duplicateNodeRef.current) duplicateNodeRef.current(node); } }
      // ⌘+F = node search
      if (meta && e.key === "f") { e.preventDefault(); setShowNodeSearch((s) => !s); }
      // ⌘+E = export dialog
      if (meta && e.key === "e") { e.preventDefault(); setShowExportDialog(true); }
      // F11 or Escape = toggle fullscreen
      if (e.key === "F11") { e.preventDefault(); toggleFullScreen(); }
      if (e.key === "Escape" && isFullScreen) { e.preventDefault(); toggleFullScreen(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, copySelection, pasteClipboard, selectedNodeId, nodes, exportGraph, toggleFullScreen, isFullScreen]);

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
  const effRouterDecisions = replayed?.routerDecisions ?? trace.routerDecisions;
  const effLoopState = replayed?.loopState ?? trace.loopState;
  const effToolCalls = replayed?.toolCalls ?? trace.toolCalls;
  const effLlmCalls = replayed?.llmCalls ?? trace.llmCalls;
  const effMcpCalls = replayed?.mcpCalls ?? trace.mcpCalls;
  const effApprovalState = replayed?.approvalState ?? trace.approvalState;
  const effTokenStreams = replayed?.tokenStreams ?? trace.tokenStreams;
  const effA2ADelegations = replayed?.a2aDelegations ?? trace.a2aDelegations;
  const effA2AMessages = replayed?.a2aMessages ?? trace.a2aMessages;

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
    // In trace mode, just navigate back without writing changes
    if (inTraceMode) {
      setNodes(entry.parentNodes);
      setEdges(entry.parentEdges);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSubgraphStack((s) => s.slice(0, -1));
      return;
    }
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
  }, [subgraphStack, nodes, edges, setNodes, setEdges, notifyChange, onSubgraphEdit, inTraceMode]);

  // Enter subgraph editing or trace viewing: load the inner graph onto the canvas.
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
      if (!inTraceMode) onSubgraphEdit?.(true);
    },
    [nodes, edges, setNodes, setEdges, onSubgraphEdit, inTraceMode]
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
      const status = effStatuses[n.id];
      return {
        ...n,
        style: n.style,
        data: {
          ...n.data,
          traceStatus: status,
          traceDetail: effDetails[n.id],
          heatmapLatency: latency,
          heatmapMax: latency !== undefined ? maxLatency : undefined,
          // Granular trace data
          traceRouterDecision: effRouterDecisions[n.id],
          traceLoopState: effLoopState[n.id],
          traceToolCall: effToolCalls[n.id],
          traceLlmCall: effLlmCalls[n.id],
          traceMcpCall: effMcpCalls[n.id],
          traceApproval: effApprovalState[n.id],
          traceTokenStream: effTokenStreams[n.id],
          traceA2ADelegation: effA2ADelegations[n.id],
          traceA2AMessages: effA2AMessages[n.id],
        },
      };
    });
  }, [nodes, inTraceMode, heatmap, effStatuses, effDetails, nodeLatencies, maxLatency, effRouterDecisions, effLoopState, effToolCalls, effLlmCalls, effMcpCalls, effApprovalState, effTokenStreams, effA2ADelegations, effA2AMessages]);

  // Animate + highlight edges as they are traversed during a live run.
  const traceEdges = useMemo(() => {
    if (!inTraceMode) return edges;
    return edges.map((e) => {
      const traversed = Boolean(effTraversed[e.id]);
      if (!traversed) return {
        ...e,
        animated: false,
        style: { stroke: "#334155", strokeWidth: 1, opacity: 0.3, ...(e.style ?? {}) },
      };
      return {
        ...e,
        animated: true,
        style: {
          stroke: "#818cf8",
          strokeWidth: 2.5,
          filter: "drop-shadow(0 0 6px rgba(129, 140, 248, 0.6))",
          ...(e.style ?? {}),
        },
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
      connectSourceIdRef.current = null;
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

  // Keep the ref in sync
  duplicateNodeRef.current = duplicateNode;

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

  // ══════════════════════════════════════════════════════════════════════
  // FULL-SCREEN LAYOUT — SaaS product editor
  // ══════════════════════════════════════════════════════════════════════
  if (isFullScreen) {
    const isPaper = canvasTheme === "paper";
    const isGraphite = canvasTheme === "graphite";

    const toolbarGroupCls = isPaper
      ? "flex items-center rounded-lg border border-slate-300 bg-slate-50/80 shadow-2xs overflow-hidden"
      : isGraphite
      ? "flex items-center rounded-lg border border-slate-700/60 bg-white/5 shadow-xs overflow-hidden"
      : "flex items-center rounded-lg border border-indigo-900/50 bg-white/5 shadow-xs overflow-hidden";

    const toolbarDividerCls = isPaper ? "w-px h-3.5 bg-slate-200" : isGraphite ? "w-px h-3.5 bg-slate-700/60" : "w-px h-3.5 bg-indigo-950/80";

    const toolbarBtnCls = isPaper
      ? "text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 transition-colors disabled:opacity-30 cursor-pointer"
      : "text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer";

    const toolbarPillBtnCls = isPaper
      ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-50/80 text-[9px] font-bold uppercase text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 transition-colors shadow-2xs cursor-pointer"
      : isGraphite
      ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700/60 bg-white/5 text-[9px] font-bold uppercase text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-900/50 bg-white/5 text-[9px] font-bold uppercase text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer";

    return (
      <div className={clsx("fixed inset-0 z-[9999] flex flex-col font-mono overflow-hidden", isPaper ? "bg-slate-100" : isGraphite ? "bg-[#0e1015]" : "bg-[#07070d]")}>
        {/* ─── Top Toolbar ─── */}
        <div className={clsx("min-h-12 shrink-0 flex items-center justify-between px-3 sm:px-4 py-1.5 border-b backdrop-blur-md relative z-40 gap-3 overflow-x-auto scrollbar-none", isPaper ? "border-slate-200 bg-white/95 text-slate-800 shadow-xs" : isGraphite ? "border-slate-700/80 bg-[#141722]/95 text-slate-200" : "border-indigo-950/80 bg-[#0a0a14]/95 text-slate-200")}>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Workflow className={clsx("h-4 w-4 shrink-0", isPaper ? "text-indigo-600" : "text-indigo-400")} />
              <span className={clsx("text-[11px] font-bold uppercase tracking-widest whitespace-nowrap", isPaper ? "text-slate-900" : "text-slate-100")}>CANVAS EDITOR</span>
            </div>
            <span className={clsx("font-mono text-[10px]", isPaper ? "text-slate-400" : "text-slate-600")}>·</span>
            <div className={clsx("flex items-center gap-2 text-[10px] font-mono whitespace-nowrap", isPaper ? "text-slate-600" : "text-slate-400")}>
              <span><b>{nodes.length}</b> nodes</span>
              <span>·</span>
              <span><b>{edges.length}</b> edges</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
            {!readOnly && (
              <>
                {/* History Group */}
                <div className={toolbarGroupCls}>
                  <button onClick={undo} disabled={historyIndex <= 0} className={clsx("p-1.5", toolbarBtnCls)} title="Undo (⌘+Z)"><Undo2 className="h-3.5 w-3.5" /></button>
                  <div className={toolbarDividerCls} />
                  <button onClick={redo} disabled={historyIndex >= history.length - 1} className={clsx("p-1.5", toolbarBtnCls)} title="Redo (⌘+Shift+Z)"><Redo2 className="h-3.5 w-3.5" /></button>
                </div>

                {/* Layout & Macros */}
                <div className={toolbarGroupCls}>
                  <button onClick={handleAutoLayout} className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase", toolbarBtnCls)} title="Auto Layout">
                    <LayoutTemplate className={clsx("h-3 w-3", isPaper ? "text-indigo-600" : "text-indigo-400")} /> AUTO LAYOUT
                  </button>
                  <div className={toolbarDividerCls} />
                  <button onClick={handleCollapse} disabled={!nodes.some((n) => n.selected || n.id === selectedNodeId)} className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase", toolbarBtnCls)} title="Collapse Selection into Macro">
                    <Boxes className={clsx("h-3 w-3", isPaper ? "text-violet-600" : "text-violet-400")} /> MACRO
                  </button>
                  <div className={toolbarDividerCls} />
                  <button onClick={() => setShowNodeSearch((s) => !s)} className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase", toolbarBtnCls)} title="Find Node (⌘+F)">
                    <Search className={clsx("h-3 w-3", isPaper ? "text-cyan-600" : "text-cyan-400")} /> FIND
                  </button>
                </div>

                {/* Portability */}
                <div className={toolbarGroupCls}>
                  <button onClick={importGraph} className={clsx("p-1.5", toolbarBtnCls)} title="Import Graph JSON"><Upload className="h-3.5 w-3.5" /></button>
                  <div className={toolbarDividerCls} />
                  <button onClick={exportGraph} className={clsx("p-1.5", toolbarBtnCls)} title="Quick Export JSON"><Download className="h-3.5 w-3.5" /></button>
                  <div className={toolbarDividerCls} />
                  <button onClick={() => setShowExportDialog(true)} className={clsx("inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold uppercase", toolbarBtnCls)} title="Export formats">
                    EXPORT…
                  </button>
                </div>

                {/* Tools */}
                <div className={toolbarGroupCls}>
                  <button onClick={() => setShowMacroLibrary((p) => !p)} className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase transition-colors cursor-pointer", showMacroLibrary ? (isPaper ? "text-indigo-700 bg-indigo-100/90 font-bold" : "text-indigo-400 bg-indigo-950/60") : toolbarBtnCls)} title="Components Library">
                    <Package className="h-3 w-3" /> COMPONENTS
                  </button>
                  <div className={toolbarDividerCls} />
                  <button onClick={() => setShowDebugger((p) => !p)} className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase transition-colors cursor-pointer", showDebugger ? (isPaper ? "text-indigo-700 bg-indigo-100/90 font-bold" : "text-indigo-400 bg-indigo-950/60") : toolbarBtnCls)} title="Debugger Panel">
                    <Bug className="h-3 w-3" /> DEBUG
                  </button>
                  <div className={toolbarDividerCls} />
                  <button onClick={() => setShowA2ADirectory(true)} className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase transition-colors cursor-pointer text-purple-400 hover:text-purple-300", toolbarBtnCls)} title="Google A2A Agent Directory">
                    <Network className="h-3 w-3 text-purple-400" /> A2A DIRECTORY
                  </button>
                  {coverage && coverage.length > 0 && (
                    <>
                      <div className={toolbarDividerCls} />
                      <button onClick={() => setCoverageMode((c) => !c)} className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase transition-colors cursor-pointer", coverageMode ? (isPaper ? "text-emerald-700 bg-emerald-100/90 font-bold" : "text-emerald-400 bg-emerald-950/60") : toolbarBtnCls)} title="Coverage">
                        <GitBranch className="h-3 w-3" /> COVERAGE
                      </button>
                    </>
                  )}
                </div>

                {/* Shortcuts & Theme */}
                <div className="relative">
                  <button onClick={() => setShowShortcuts((s) => !s)} className={toolbarPillBtnCls} title="Keyboard Shortcuts">
                    <Keyboard className="h-3.5 w-3.5" /> SHORTCUTS
                  </button>
                  {showShortcuts && (
                    <div className={clsx(
                      "absolute right-0 top-8 z-[100] w-64 space-y-1.5 rounded-xl p-3 shadow-2xl backdrop-blur-2xl border",
                      isPaper
                        ? "border-slate-300 bg-white/95 text-slate-800 shadow-xl"
                        : isGraphite
                        ? "border-slate-700/80 bg-[#141722]/95 text-slate-200"
                        : "border-indigo-500/30 bg-[#0a0a14]/95 text-slate-200"
                    )}>
                      <div className={clsx("text-[9px] font-bold uppercase tracking-widest mb-1.5", isPaper ? "text-indigo-600" : "text-indigo-400")}>KEYBOARD SHORTCUTS</div>
                      {[["⌘+Z", "undo"], ["⌘+Shift+Z", "redo"], ["⌘+C", "copy"], ["⌘+V", "paste"], ["⌘+D", "duplicate"], ["⌘+F", "find node"], ["⌘+E", "export"], ["F11", "fullscreen"], ["⌥+click", "duplicate node"], ["⌫", "delete"]].map(([key, desc]) => (
                        <div key={key} className="flex items-center justify-between gap-2 text-[9px]">
                          <kbd className={clsx("rounded px-1 py-0.5 font-mono", isPaper ? "border border-slate-300 bg-slate-100 text-slate-700" : "border border-slate-700 bg-black/60 text-slate-300")}>{key}</kbd>
                          <span className={isPaper ? "text-slate-600" : "text-slate-400"}>{desc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={cycleTheme} className={toolbarPillBtnCls} title="Cycle Theme">
                  <Copy className="h-3.5 w-3.5" /> {canvasTheme?.toUpperCase() ?? "THEME"}
                </button>
              </>
            )}

            <button onClick={toggleFullScreen} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-500 transition-all cursor-pointer shadow-md shadow-indigo-500/25 shrink-0" title="Exit Full-screen (F11)">
              <Minimize className="h-3.5 w-3.5" /> EXIT FULLSCREEN
            </button>
          </div>
        </div>

        {/* ─── Trace status bar ─── */}
        {inTraceMode && (
          <div className={clsx("shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b text-[9px]", isPaper ? "border-indigo-200 bg-indigo-50/90 text-indigo-900" : isGraphite ? "border-indigo-500/30 bg-indigo-950/40 text-indigo-200" : "border-indigo-500/30 bg-indigo-950/40 text-indigo-200")}>
            <div className="flex items-center gap-2">
              <span className={clsx("inline-block h-2 w-2 rounded-full", trace.connected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              <span className={clsx("font-bold", isPaper ? "text-indigo-800" : "text-indigo-300")}>{isPreview ? "GHOST PREVIEW" : "LIVE TRACE"} · {effExecutionStatus ?? "CONNECTING…"}</span>
            </div>
            <div className="flex items-center gap-2">{traceHeaderExtra}</div>
          </div>
        )}

        {/* ─── Subgraph breadcrumb ─── */}
        {inSubgraph && (
          <div className={clsx("shrink-0 flex items-center justify-between px-3 py-1.5 border-b text-[9px]", isPaper ? "border-slate-200 bg-slate-100 text-slate-800" : isGraphite ? "border-slate-600 bg-slate-900/60 text-slate-200" : "border-slate-700/50 bg-slate-900/60 text-slate-200")}>
            <div className={clsx("flex items-center gap-1.5", isPaper ? "text-slate-700" : "text-slate-400")}>
              <Boxes className="h-3 w-3" />
              <span className="font-bold uppercase">{inTraceMode ? "SUBGRAPH TRACE" : "Editing macro"}</span>
              <span className={clsx("font-bold", isPaper ? "text-indigo-600" : "text-indigo-400")}>› {subgraphStack[subgraphStack.length - 1].label}</span>
            </div>
            <button onClick={writeBackSubgraph} className="inline-flex items-center gap-1 rounded border border-indigo-500/50 bg-indigo-600/80 px-2 py-1 text-[9px] font-bold text-white hover:bg-indigo-500 transition-colors cursor-pointer">
              <CornerUpLeft className="h-3 w-3" /> {inTraceMode ? "BACK" : "EXIT"}
            </button>
          </div>
        )}

        {/* ─── Main body: Left sidebar + Canvas + Right sidebar ─── */}
        <div className="flex-1 flex min-h-0">
          {/* Left sidebar: Node Palette (collapsible) */}
          {!readOnly && (
            <div className={clsx(
              "shrink-0 border-r transition-all duration-200 overflow-hidden",
              canvasTheme === "paper"
                ? "border-slate-200 bg-white"
                : canvasTheme === "graphite"
                  ? "border-slate-600 bg-[#1a1d27]"
                  : "border-indigo-900/40 bg-[#0a0a14]",
              fsLeftOpen ? "w-56" : "w-10"
            )}>
              <div className={clsx("flex items-center justify-between px-2 py-2 border-b", canvasTheme === "paper" ? "border-slate-200" : canvasTheme === "graphite" ? "border-slate-600" : "border-indigo-900/30")}>
                {fsLeftOpen && <span className={clsx("text-[9px] font-bold uppercase tracking-widest", canvasTheme === "paper" ? "text-indigo-700" : "text-indigo-400")}>NODES</span>}
                <button onClick={() => setFsLeftOpen((p) => !p)} className={clsx("p-1 rounded transition-colors cursor-pointer", canvasTheme === "paper" ? "hover:bg-slate-100 text-slate-400 hover:text-slate-600" : "hover:bg-white/5 text-slate-500 hover:text-white")} title={fsLeftOpen ? "Collapse palette" : "Expand palette"}>
                  {fsLeftOpen ? <X className="h-3.5 w-3.5" /> : <Boxes className="h-3.5 w-3.5" />}
                </button>
              </div>
              {fsLeftOpen && (
                <div className="p-2 flex-1 min-h-0 overflow-hidden" style={{ height: "calc(100% - 36px)" }}>
                  <NodePalette onDragStart={onDragStart} disabled={inTraceMode} />
                </div>
              )}
            </div>
          )}

          {/* Center canvas */}
          <div ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver} className={clsx(
            "flex-1 min-w-0 relative",
            canvasTheme === "paper"
              ? "bg-slate-50"
              : canvasTheme === "graphite"
                ? "bg-[#14161c]"
                : "bg-[#07070d]"
          )}>
            {/* Validation warnings (Floating at bottom-left in Fullscreen) */}
            {!inTraceMode && !readOnly && issues.length > 0 && (
              <div className="absolute bottom-3 left-4 z-20 font-mono">
                <div className="relative">
                  {showValidationDetails && (
                    <div className="absolute bottom-9 left-0 w-80 max-h-52 overflow-y-auto rounded-xl border border-amber-400/50 dark:border-amber-500/40 bg-white/95 dark:bg-[#0d0e1a]/95 backdrop-blur-md shadow-2xl p-3 space-y-1.5 z-30">
                      <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-500/20 pb-1.5 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          Graph Issues ({issues.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowValidationDetails(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[9px] leading-tight text-slate-800 dark:text-slate-200">
                          <span className={clsx("shrink-0 font-bold", issue.severity === "error" ? "text-red-500" : "text-amber-500")}>
                            [{issue.severity.toUpperCase()}]
                          </span>
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowValidationDetails((p) => !p)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-400/60 dark:border-amber-500/40 bg-amber-50/95 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all shadow-md backdrop-blur-md text-[10px] font-bold cursor-pointer"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>
                      {issues.filter((i) => i.severity === "error").length} Error(s) · {issues.filter((i) => i.severity === "warning").length} Warning(s)
                    </span>
                    {showValidationDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            )}

            <ReactFlow
              nodes={traceNodes}
              edges={displayedEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onNodesDelete={onNodesDelete}
              onEdgesDelete={onEdgesDelete}
              onConnect={onConnect}
              onConnectStart={(_event, params) => {
                // Track connection start for Quick-Connect Radial Search
                if (params?.nodeId) {
                  connectSourceIdRef.current = params.nodeId;
                }
              }}
              onConnectEnd={(event) => {
                if (inTraceMode) return;
                const sourceId = connectSourceIdRef.current;
                connectSourceIdRef.current = null;
                if (!sourceId || !wrapperRef.current) return;
                const targetEl = event.target as HTMLElement | null;
                const isHandle = targetEl?.classList?.contains("react-flow__handle") || targetEl?.closest?.(".react-flow__handle");
                if (isHandle) return;

                const mouseEv = event as MouseEvent;
                const touchEv = event as TouchEvent;
                const clientX = mouseEv.clientX ?? touchEv.touches?.[0]?.clientX ?? (touchEv.changedTouches?.[0]?.clientX ?? 0);
                const clientY = mouseEv.clientY ?? touchEv.touches?.[0]?.clientY ?? (touchEv.changedTouches?.[0]?.clientY ?? 0);
                if (clientX > 0 && clientY > 0) {
                  setQuickConnect({
                    position: { x: clientX, y: clientY },
                    sourceNodeId: sourceId,
                  });
                }
              }}
              onViewportChange={(vp) => setViewport(vp)}
              onNodeClick={(event, node) => {
                if (event.altKey) { duplicateNode(node); return; }
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
                if (!fsRightOpen) setFsRightOpen(true);
              }}
              onEdgeClick={onEdgeClick}
              onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
              nodeTypes={canvasNodeTypes}
              fitView
              minZoom={0.15}
              maxZoom={2}
              snapToGrid
              snapGrid={[12, 12]}
              nodesDraggable={!inTraceMode}
              nodesConnectable={!inTraceMode}
              edgesFocusable={!inTraceMode}
              elementsSelectable={!inTraceMode}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color={canvasTheme === "paper" ? "#cbd5e1" : canvasTheme === "graphite" ? "#2a2e3a" : isDark ? "#334155" : "#cbd5e1"} />
              <Controls className={clsx(
                "!shadow-lg [&>button]:!shadow-sm",
                canvasTheme === "paper"
                  ? "!border-slate-200 !bg-white [&>button]:!border-slate-200 [&>button]:!text-slate-700 [&>button]:!bg-white [&>button:hover]:!bg-slate-100"
                  : canvasTheme === "graphite"
                    ? "!border-slate-600 !bg-[#1a1d27] [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button]:!bg-[#1a1d27] [&>button:hover]:!bg-slate-700"
                    : "!border-slate-700 !bg-[#0a0a14] [&>button]:!border-slate-700 [&>button]:!text-slate-400 [&>button]:!bg-[#0a0a14] [&>button:hover]:!bg-slate-800 [&>button:hover]:!text-white"
              )} position="bottom-right" />
              <MiniMap
                pannable
                zoomable
                className={clsx(
                  "!shadow-lg",
                  canvasTheme === "paper"
                    ? "!bg-white !border-slate-200"
                    : canvasTheme === "graphite"
                      ? "!bg-[#1a1d27] !border-slate-600"
                      : "!bg-[#0a0a14] !border-slate-700"
                )}
                maskColor={isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(241, 245, 249, 0.7)"}
                nodeColor={(n) => {
                  const t = n.data?.traceStatus;
                  if (t === "RUNNING") return "#818cf8";
                  if (t === "SUCCESS") return "#34d399";
                  if (t === "FAILED") return "#f87171";
                  if (t === "AWAITING_APPROVAL") return "#fbbf24";
                  return canvasTheme === "paper" ? "#cbd5e1" : canvasTheme === "graphite" ? "#2a2e3a" : isDark ? "#334155" : "#cbd5e1";
                }}
              />
            </ReactFlow>

            {/* Node search overlay */}
            {showNodeSearch && (
              <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 w-80">
                <div className={clsx(
                  "rounded-lg backdrop-blur-sm p-2.5 shadow-2xl",
                  canvasTheme === "paper"
                    ? "border border-indigo-300 bg-white/95"
                    : canvasTheme === "graphite"
                      ? "border border-indigo-500/50 bg-[#1a1d27]/95"
                      : "border border-indigo-500/50 bg-[#0a0a14]/95"
                )}>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-indigo-400 shrink-0" />
                    <input autoFocus value={nodeSearchQuery} onChange={(e) => setNodeSearchQuery(e.target.value)} placeholder="Search nodes..." className={clsx("flex-1 bg-transparent text-[11px] font-mono placeholder:text-slate-500 focus:outline-none", canvasTheme === "paper" ? "text-slate-900" : "text-white")}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setShowNodeSearch(false); setNodeSearchQuery(""); }
                        if (e.key === "Enter" && filteredNodes.length > 0) focusNode(filteredNodes[0].id);
                      }}
                    />
                    <button onClick={() => { setShowNodeSearch(false); setNodeSearchQuery(""); }} className={clsx("hover:text-opacity-80", canvasTheme === "paper" ? "text-slate-400 hover:text-slate-600" : "text-slate-500 hover:text-white")}><X className="h-3.5 w-3.5" /></button>
                  </div>
                  {nodeSearchQuery && filteredNodes.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5">
                      {filteredNodes.map((n) => (
                        <button key={n.id} onClick={() => focusNode(n.id)} className={clsx("w-full flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors cursor-pointer", canvasTheme === "paper" ? "hover:bg-indigo-50" : "hover:bg-indigo-500/20")}>
                          <span className={clsx("text-[8px] font-mono uppercase shrink-0 w-16", canvasTheme === "paper" ? "text-indigo-600" : "text-indigo-400")}>{n.type}</span>
                          <span className={clsx("text-[10px] font-mono truncate", canvasTheme === "paper" ? "text-slate-800" : "text-white")}>{n.data.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {nodeSearchQuery && filteredNodes.length === 0 && <p className="mt-2 text-[10px] text-slate-500 text-center">No nodes found</p>}
                </div>
              </div>
            )}

            {/* Empty state */}
            {nodes.length <= 2 && !inTraceMode && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Workflow className={clsx("h-12 w-12 mx-auto", canvasTheme === "paper" ? "text-indigo-400/60" : "text-indigo-500/40")} />
                  <p className={clsx("text-[12px] font-medium", canvasTheme === "paper" ? "text-slate-600" : "text-slate-500")}>Drag nodes from the left palette</p>
                  <p className={clsx("text-[10px]", canvasTheme === "paper" ? "text-slate-500" : "text-slate-600")}>Connect them to design your multi-agent architecture</p>
                </div>
              </div>
            )}

            {/* Terminal banner */}
            {terminal && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg border border-emerald-500/50 bg-emerald-950/80 backdrop-blur-sm px-5 py-2 text-[10px] font-bold tracking-widest text-emerald-300 shadow-xl flex items-center gap-1.5">
                <Check className="h-3 w-3 shrink-0" />
                <span>{isPreview ? "PREVIEW" : "EXECUTION"} {effExecutionStatus}</span>
              </div>
            )}
          </div>

          {/* Right sidebar: Inspector (collapsible) */}
          <div className={clsx(
            "shrink-0 border-l transition-all duration-200 overflow-hidden flex flex-col",
            canvasTheme === "paper"
              ? "border-slate-200 bg-white"
              : canvasTheme === "graphite"
                ? "border-slate-600 bg-[#1a1d27]"
                : "border-indigo-900/40 bg-[#0a0a14]",
            fsRightOpen ? "w-72" : "w-10"
          )}>
            <div className={clsx("flex items-center justify-between px-2 py-2 border-b", canvasTheme === "paper" ? "border-slate-200" : canvasTheme === "graphite" ? "border-slate-600" : "border-indigo-900/30")}>
              {fsRightOpen && <span className={clsx("text-[9px] font-bold uppercase tracking-widest", canvasTheme === "paper" ? "text-indigo-700" : "text-indigo-400")}>INSPECTOR</span>}
              <button onClick={() => setFsRightOpen((p) => !p)} className={clsx("p-1 rounded transition-colors cursor-pointer", canvasTheme === "paper" ? "hover:bg-slate-100 text-slate-400 hover:text-slate-600" : "hover:bg-white/5 text-slate-500 hover:text-white")} title={fsRightOpen ? "Collapse inspector" : "Expand inspector"}>
                {fsRightOpen ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
              </button>
            </div>
            {fsRightOpen && (
              <div className="flex-1 overflow-y-auto p-3">
                {inTraceMode ? (
                  selectedNode && selectedNode.type === "subgraph" ? (
                    /* In trace mode, allow opening subgraph nodes to view inner trace */
                    <NodeInspector node={selectedNode} onUpdate={() => { }} onDelete={() => { }} allNodeIds={nodes.map((n) => n.id)} onOpenSubgraph={openSubgraph} onToggleBreakpoint={handleToggleBreakpoint} />
                  ) : (
                    <div className="space-y-3">
                      <div className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold">{isPreview ? "GHOST PREVIEW" : "LIVE TRACE"}</div>
                      <p className="text-[9px] text-slate-400 leading-relaxed">{isPreview ? "Dry-run — nothing persisted, approvals auto-pass." : "Canvas locked while agent traverses the graph."}</p>
                      <div className="space-y-1 text-[9px]">
                        <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" /> RUNNING</div>
                        <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> SUCCESS</div>
                        <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> AWAITING APPROVAL</div>
                        <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-red-400" /> FAILED</div>
                      </div>
                      <button onClick={() => setHeatmap((h) => !h)} className={clsx("w-full inline-flex items-center justify-center gap-1.5 rounded border px-2 py-2 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer", heatmap ? "border-orange-400 bg-orange-950/40 text-orange-300" : "border-slate-700 text-slate-400 hover:border-orange-400 hover:text-orange-300")}>
                        <Flame className="h-3 w-3" /> {heatmap ? "HEATMAP ON" : "LATENCY HEATMAP"}
                      </button>
                      <div className="border-t border-indigo-900/30 pt-2 space-y-1.5">
                        <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">STATS</div>
                        <div className="flex justify-between text-[9px] text-slate-400"><span>Events</span><span className="text-indigo-400 font-bold">{trace.events.length}</span></div>
                        <div className="flex justify-between text-[9px] text-slate-400"><span>Nodes touched</span><span className="text-indigo-400 font-bold">{Object.keys(effStatuses).length}</span></div>
                        <div className="flex justify-between text-[9px] text-slate-400"><span>Status</span><span className="text-emerald-400 font-bold">{effExecutionStatus ?? "—"}</span></div>
                      </div>
                    </div>
                  )
                ) : selectedEdge ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={clsx("text-[9px] uppercase tracking-widest font-bold flex items-center gap-1.5", isPaper ? "text-indigo-700" : "text-indigo-400")}><Link2 className="h-3 w-3" /> EDGE</div>
                      <button onClick={deleteSelected} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-500/30 text-[9px] text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"><X className="h-3 w-3" /></button>
                    </div>
                    <div className="space-y-1">
                      <label className={clsx("text-[8px] font-bold uppercase tracking-widest", isPaper ? "text-indigo-700" : "text-indigo-400")}>Branch Label</label>
                      <input value={typeof selectedEdge.label === "string" ? selectedEdge.label : ""} onChange={(e) => updateEdgeLabel(selectedEdge.id, e.target.value)} placeholder="true / false / high / worker" className={clsx("w-full rounded border px-2.5 py-1.5 text-[10px] font-mono focus:border-indigo-500 focus:outline-none", isPaper ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400" : "border-slate-700 bg-black/40 text-white placeholder:text-slate-600")} />
                    </div>
                    <div className={clsx("text-[8px] font-mono", isPaper ? "text-slate-600" : "text-slate-500")}>{selectedEdge.source} → {selectedEdge.target}</div>
                  </div>
                ) : selectedNode ? (
                  <NodeInspector node={selectedNode} onUpdate={(patch) => updateNodeData(selectedNode.id, patch)} onDelete={deleteSelected} allNodeIds={nodes.map((n) => n.id)} onOpenSubgraph={openSubgraph} onToggleBreakpoint={handleToggleBreakpoint} />
                ) : (
                  <div className="space-y-3">
                    <div className={clsx("text-[9px] uppercase tracking-widest font-bold", isPaper ? "text-indigo-700" : "text-indigo-400")}>INSPECTOR</div>
                    <p className={clsx("text-[9px] leading-relaxed", isPaper ? "text-slate-600" : "text-slate-400")}>Select a node or edge to configure it.</p>
                    <div className={clsx("border-t pt-2 space-y-1.5", isPaper ? "border-slate-200" : "border-indigo-900/30")}>
                      <div className={clsx("text-[8px] uppercase tracking-wider font-bold", isPaper ? "text-slate-500" : "text-slate-500")}>GRAPH STATS</div>
                      <div className={clsx("flex justify-between text-[9px]", isPaper ? "text-slate-600" : "text-slate-400")}><span>Nodes</span><span className={clsx("font-bold", isPaper ? "text-indigo-700" : "text-indigo-400")}>{nodes.length}</span></div>
                      <div className={clsx("flex justify-between text-[9px]", isPaper ? "text-slate-600" : "text-slate-400")}><span>Edges</span><span className={clsx("font-bold", isPaper ? "text-indigo-700" : "text-indigo-400")}>{edges.length}</span></div>
                      <div className={clsx("flex justify-between text-[9px]", isPaper ? "text-slate-600" : "text-slate-400")}><span>Branches</span><span className={clsx("font-bold", isPaper ? "text-indigo-700" : "text-indigo-400")}>{edges.filter((e) => e.label).length}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Time scrubber ─── */}
        {inTraceMode && trace.events.length > 1 && (
          <div className={clsx("shrink-0 flex items-center gap-2 px-3 py-1.5 border-t", canvasTheme === "paper" ? "border-slate-200 bg-white" : canvasTheme === "graphite" ? "border-slate-600 bg-[#1a1d27]" : "border-indigo-900/40 bg-[#0a0a14]")}>
            <button onClick={toggleScrubPlay} className={clsx("inline-flex h-6 w-6 items-center justify-center rounded border transition-colors cursor-pointer", canvasTheme === "paper" ? "border-indigo-300 text-indigo-600 hover:bg-indigo-50" : "border-indigo-500/50 text-indigo-300 hover:bg-indigo-950/50")}>
              {scrubPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
            <input type="range" min={0} max={totalEvents} value={clampedScrubIndex} onChange={(e) => { setScrubIndex(Number(e.target.value)); setScrubPlaying(false); }} className="flex-1 accent-indigo-500 cursor-pointer" />
            <span className={clsx("shrink-0 text-[9px] tabular-nums", canvasTheme === "paper" ? "text-slate-600" : "text-slate-500")}>{clampedScrubIndex}/{totalEvents}</span>
            <select value={scrubSpeed} onChange={(e) => setScrubSpeed(Number(e.target.value))} className={clsx("shrink-0 rounded border px-1 py-0.5 text-[9px] cursor-pointer", canvasTheme === "paper" ? "border-slate-200 bg-white text-slate-700" : canvasTheme === "graphite" ? "border-slate-600 bg-[#1a1d27] text-slate-300" : "border-slate-700 bg-[#0a0a14] text-slate-400")}>
              <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option><option value={8}>8×</option>
            </select>
            {scrubIndex !== null && <button onClick={() => { setScrubIndex(null); setScrubPlaying(false); }} className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-emerald-400 hover:bg-emerald-950/50 transition-colors cursor-pointer"><Radio className="h-2.5 w-2.5" /> LIVE</button>}
          </div>
        )}

        {/* ─── Live event console ─── */}
        {inTraceMode && trace.events.length > 0 && (
          <div className={clsx("shrink-0 h-28 overflow-y-auto border-t p-2 space-y-0.5 font-mono text-[8px]", canvasTheme === "paper" ? "border-slate-200 bg-slate-50" : canvasTheme === "graphite" ? "border-slate-600 bg-black/50" : "border-indigo-900/40 bg-black/50")}>
            {trace.events.slice(-30).map((ev, i) => {
              const nodeId = "nodeId" in ev ? ev.nodeId : undefined;
              const detail = "detail" in ev ? ev.detail : undefined;
              return (
                <div key={i} className={clsx("flex items-center gap-2", canvasTheme === "paper" ? "text-slate-600" : "text-slate-500")}>
                  <span className="shrink-0">{new Date(ev.at).toLocaleTimeString()}</span>
                  <span className={clsx("font-semibold shrink-0", canvasTheme === "paper" ? "text-indigo-600" : "text-indigo-400")}>{ev.type}</span>
                  {nodeId && <span className={clsx("truncate", canvasTheme === "paper" ? "text-slate-800" : "text-slate-300")}>{nodeId}</span>}
                  {detail && <span className={clsx("truncate", canvasTheme === "paper" ? "text-slate-500" : "text-slate-600")}>{detail}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Quick-Connect Radial Search ─── */}
        {quickConnect && (
          <QuickConnectSearch
            position={quickConnect.position}
            sourceNodeId={quickConnect.sourceNodeId}
            onSelect={handleQuickConnectSelect}
            onClose={() => setQuickConnect(null)}
          />
        )}
        {/* ─── Canvas Copilot (Talk to Graph NL Generator) ─── */}
        {!inTraceMode && !readOnly && (
          <CanvasCopilot
            onGraphGenerated={handleCopilotGraphGenerated}
            disabled={inTraceMode}
            position="bottom"
          />
        )}




        {/* ─── Alignment Bar ─── */}
        {selectedNodesForAlignment.length >= 2 && !inTraceMode && (
          <AlignmentBar
            selectedNodes={selectedNodesForAlignment}
            edges={edges}
            onAlign={handleAlignment}
            onDismiss={() => {
              nodes.forEach((n) => {
                if (n.selected) {
                  setNodes((prev) => prev.map((p) => p.id === n.id ? { ...p, selected: false } : p));
                }
              });
            }}
          />
        )}

        {/* ─── Collaboration Overlay ─── */}
        <CollaborationOverlay
          canvasContainerRef={wrapperRef}
          viewport={viewport}
        />

        {/* ─── Export Dialog ─── */}
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          graph={flowToGraph(nodes, edges)}
          canvasContainerRef={wrapperRef}
        />

        {/* ─── Macro Library Panel ─── */}
        {showMacroLibrary && (
          <div className={clsx("absolute left-14 top-12 z-20 w-64 max-h-[70vh] overflow-y-auto rounded-lg backdrop-blur-md p-3 shadow-2xl font-mono",
            canvasTheme === "paper"
              ? "border border-slate-200 bg-white/95"
              : canvasTheme === "graphite"
                ? "border border-slate-600/60 bg-[#1a1d27]/95"
                : "border border-slate-700/60 bg-[#0a0a14]/95"
          )}>
            <MacroLibrary
              nodes={nodes}
              edges={edges}
              selectedNodeIds={new Set(nodes.filter((n) => n.selected).map((n) => n.id))}
              onAddMacro={handleAddMacro}
              isOpen={showMacroLibrary}
              onToggle={() => setShowMacroLibrary(!showMacroLibrary)}
            />
          </div>
        )}

        {/* ─── Debugger Panel ─── */}
        {showDebugger && (
          <div className={clsx("absolute right-14 top-12 z-20 w-64 max-h-[60vh] overflow-y-auto rounded-lg backdrop-blur-md p-3 shadow-2xl",
            canvasTheme === "paper"
              ? "border border-slate-200 bg-white/95"
              : canvasTheme === "graphite"
                ? "border border-slate-600/60 bg-[#1a1d27]/95"
                : "border border-slate-700/60 bg-[#0a0a14]/95"
          )}>
            <DebuggerPanel
              nodeStatuses={effStatuses}
              nodeDetails={effDetails}
              isRunning={inTraceMode && effExecutionStatus === "RUNNING"}
              onToggleBreakpoint={handleToggleBreakpoint}
            />
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // NORMAL LAYOUT (embedded in page)
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full gap-3 font-mono">
      {/* Left palette (collapsible) */}
      {!readOnly && (
        <div className={clsx(
          "shrink-0 transition-all duration-200 overflow-hidden rounded border border-slate-200 dark:border-indigo-900/40 bg-white/90 dark:bg-[#0a0a0a]/70 shadow-sm flex flex-col h-[640px] max-h-[calc(100vh-200px)]",
          normLeftOpen ? "w-52" : "w-10"
        )}>
          <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-200 dark:border-indigo-900/40 bg-slate-50/50 dark:bg-indigo-950/20 shrink-0">
            {normLeftOpen && <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">NODES</span>}
            <button
              type="button"
              onClick={() => setNormLeftOpen((p) => !p)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              title={normLeftOpen ? "Collapse palette" : "Expand palette"}
            >
              {normLeftOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
            </button>
          </div>
          {normLeftOpen && (
            <div className="p-2 flex-1 min-h-0 overflow-hidden">
              <NodePalette onDragStart={onDragStart} disabled={inTraceMode} />
            </div>
          )}
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
        {inSubgraph && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-400/50 dark:border-slate-500/50 bg-slate-100 dark:bg-slate-900/60 px-3 py-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-700 dark:text-slate-300">
              <Boxes className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-bold uppercase tracking-widest">{inTraceMode ? "SUBGRAPH TRACE" : "Editing macro"}</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">› {subgraphStack[subgraphStack.length - 1].label}</span>
              {!inTraceMode && <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold">(exit to save it back)</span>}
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
            onConnectStart={(_event, params) => {
              if (params?.nodeId) {
                connectSourceIdRef.current = params.nodeId;
              }
            }}
            onConnectEnd={(event) => {
              if (inTraceMode) return;
              const sourceId = connectSourceIdRef.current;
              connectSourceIdRef.current = null;
              if (!sourceId || !wrapperRef.current) return;
              const targetEl = event.target as HTMLElement | null;
              const isHandle = targetEl?.classList?.contains("react-flow__handle") || targetEl?.closest?.(".react-flow__handle");
              if (isHandle) return;

              const mouseEv = event as MouseEvent;
              const touchEv = event as TouchEvent;
              const clientX = mouseEv.clientX ?? touchEv.touches?.[0]?.clientX ?? (touchEv.changedTouches?.[0]?.clientX ?? 0);
              const clientY = mouseEv.clientY ?? touchEv.touches?.[0]?.clientY ?? (touchEv.changedTouches?.[0]?.clientY ?? 0);
              if (clientX > 0 && clientY > 0) {
                setQuickConnect({
                  position: { x: clientX, y: clientY },
                  sourceNodeId: sourceId,
                });
              }
            }}
            onViewportChange={(vp) => setViewport(vp)}
            onNodeClick={(event, node) => {
              if (event.altKey) {
                duplicateNode(node);
                return;
              }
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
              if (!normRightOpen) setNormRightOpen(true);
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

          {/* Shortcut hints + theme + fullscreen (edit mode) */}
          {!inTraceMode && !readOnly && (
            <div className="absolute right-2 top-2 z-30 flex items-center gap-1.5 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowShortcuts((s) => !s)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0c0d18]/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors shadow-sm cursor-pointer"
                  title="Keyboard shortcuts"
                >
                  <Keyboard className="h-3 w-3" /> SHORTCUTS
                </button>
                {showShortcuts && (
                  <div className="absolute right-0 top-7 z-[100] w-64 space-y-1.5 rounded-xl border border-slate-200/80 dark:border-indigo-500/30 bg-white/75 dark:bg-[#0c0d18]/75 p-3 shadow-2xl backdrop-blur-6xl">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">SHORTCUTS</div>
                    {[
                      ["⌘/Ctrl + Z", "undo"],
                      ["⌘/Ctrl + Shift + Z", "redo"],
                      ["⌘/Ctrl + C", "copy selected"],
                      ["⌘/Ctrl + V", "paste"],
                      ["⌘/Ctrl + D", "duplicate"],
                      ["⌘/Ctrl + F", "find node"],
                      ["⌘/Ctrl + E", "export graph"],
                      ["F11", "toggle full-screen"],
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
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0c0d18]/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors shadow-sm cursor-pointer"
                title={`Theme: ${canvasTheme} — click to cycle`}
              >
                <Copy className="h-3 w-3" /> {canvasTheme?.toUpperCase() ?? "THEME"}
              </button>
              <button
                type="button"
                onClick={toggleFullScreen}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-400 bg-indigo-600 text-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-500 transition-colors shadow-sm cursor-pointer"
                title="Toggle full-screen (F11)"
              >
                {isFullScreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
                {isFullScreen ? "EXIT" : "FULLSCREEN"}
              </button>
            </div>
          )}

          {/* Streamlined segmented toolbar (edit mode) */}
          {!inTraceMode && !readOnly && (
            <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-20rem)]">
              {/* History group */}
              <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0c0d18]/95 shadow-sm overflow-hidden backdrop-blur-md">
                <button
                  type="button"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
                  title="Undo (⌘+Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
                  title="Redo (⌘+Shift+Z)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Layout & Selection group */}
              <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0c0d18]/95 shadow-sm overflow-hidden backdrop-blur-md">
                <button
                  type="button"
                  onClick={handleAutoLayout}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Arrange nodes in layered columns"
                >
                  <LayoutTemplate className="h-3 w-3" /> AUTO LAYOUT
                </button>
                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={handleCollapse}
                  disabled={!nodes.some((n) => n.selected || n.id === selectedNodeId)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer disabled:opacity-30"
                  title="Collapse selection into macro"
                >
                  <Boxes className="h-3 w-3" /> MACRO
                </button>
                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={() => setShowNodeSearch((s) => !s)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Find node (⌘+F)"
                >
                  <Search className="h-3 w-3" /> FIND
                </button>
              </div>

              {/* Portability group */}
              <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0c0d18]/95 shadow-sm overflow-hidden backdrop-blur-md">
                <button
                  type="button"
                  onClick={importGraph}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Import graph JSON"
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={exportGraph}
                  className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Quick export JSON"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={() => setShowExportDialog(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Export graph (PNG/SVG/PDF/Mermaid/LangGraph)"
                >
                  EXPORT…
                </button>
              </div>

              {/* Tools group */}
              <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0c0d18]/95 shadow-sm overflow-hidden backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setShowMacroLibrary((p) => !p)}
                  className={clsx("inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer", showMacroLibrary ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")}
                  title="Toggle My Components library"
                >
                  <Package className="h-3 w-3" /> COMPONENTS
                </button>
                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={() => setShowDebugger((p) => !p)}
                  className={clsx("inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer", showDebugger ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")}
                  title="Toggle debugger panel"
                >
                  <Bug className="h-3 w-3" /> DEBUG
                </button>
                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={() => setShowA2ADirectory(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50"
                  title="Open Google A2A Agent Directory"
                >
                  <Network className="h-3 w-3 text-purple-500" /> A2A DIRECTORY
                </button>
                {coverage && coverage.length > 0 && (
                  <>
                    <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                    <button
                      type="button"
                      onClick={() => setCoverageMode((c) => !c)}
                      className={clsx(
                        "inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer",
                        coverageMode
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                      title="Branch coverage highlights"
                    >
                      <GitBranch className="h-3 w-3" /> {coverageMode ? "COVERAGE ON" : "COVERAGE"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Node search overlay */}
          {showNodeSearch && (
            <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 w-72">
              <div className="rounded-lg border border-indigo-300 dark:border-indigo-500/50 bg-white/95 dark:bg-[#0c0d18]/95 p-2 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <input
                    autoFocus
                    value={nodeSearchQuery}
                    onChange={(e) => setNodeSearchQuery(e.target.value)}
                    placeholder="Search nodes by name, type, or prompt..."
                    className="flex-1 bg-transparent text-[11px] font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setShowNodeSearch(false); setNodeSearchQuery(""); }
                      if (e.key === "Enter" && filteredNodes.length > 0) focusNode(filteredNodes[0].id);
                    }}
                  />
                  <button type="button" onClick={() => { setShowNodeSearch(false); setNodeSearchQuery(""); }} className="text-slate-400 hover:text-slate-600"><X className="h-3 w-3" /></button>
                </div>
                {nodeSearchQuery && filteredNodes.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                    {filteredNodes.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => focusNode(n.id)}
                        className="w-full flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                      >
                        <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 uppercase shrink-0 w-16">{n.type}</span>
                        <span className="text-[10px] font-mono text-slate-800 dark:text-slate-200 truncate">{n.data.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {nodeSearchQuery && filteredNodes.length === 0 && (
                  <p className="mt-2 text-[10px] text-slate-500 text-center">No nodes found</p>
                )}
              </div>
            </div>
          )}

          {/* Validation warnings (Floating at bottom-left of canvas window) */}
          {!inTraceMode && !readOnly && issues.length > 0 && (
            <div className="absolute bottom-3 left-14 z-20 font-mono">
              <div className="relative">
                {showValidationDetails && (
                  <div className="absolute bottom-9 left-0 w-80 max-h-52 overflow-y-auto rounded-xl border border-amber-400/50 dark:border-amber-500/40 bg-white/95 dark:bg-[#0d0e1a]/95 backdrop-blur-md shadow-2xl p-3 space-y-1.5 z-30">
                    <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-500/20 pb-1.5 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        Graph Issues ({issues.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowValidationDetails(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[9px] leading-tight text-slate-800 dark:text-slate-200">
                        <span className={clsx("shrink-0 font-bold", issue.severity === "error" ? "text-red-500" : "text-amber-500")}>
                          [{issue.severity.toUpperCase()}]
                        </span>
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowValidationDetails((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-400/60 dark:border-amber-500/40 bg-amber-50/95 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all shadow-md backdrop-blur-md text-[10px] font-bold cursor-pointer"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>
                    {issues.filter((i) => i.severity === "error").length} Error(s) · {issues.filter((i) => i.severity === "warning").length} Warning(s)
                  </span>
                  {showValidationDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Trace time-travel scrubber */}
        {inTraceMode && trace.events.length > 1 && (
          <div className="mt-2 flex items-center gap-2 rounded border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-[#0a0a14] px-3 py-1.5 text-[9px] font-mono">
            <button
              type="button"
              onClick={toggleScrubPlay}
              className="shrink-0 p-1 rounded hover:bg-indigo-100 dark:hover:bg-white/10 text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-white transition-colors cursor-pointer"
              title={scrubPlaying ? "Pause replay" : "Play replay"}
            >
              {scrubPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={trace.events.length - 1}
              value={scrubIndex ?? trace.events.length - 1}
              onChange={(e) => {
                setScrubIndex(Number(e.target.value));
                setScrubPlaying(false);
              }}
              className="flex-1 accent-indigo-600 dark:accent-indigo-400 h-1 bg-slate-300 dark:bg-slate-700 rounded-lg cursor-pointer"
            />
            <span className="text-slate-600 dark:text-slate-400 shrink-0 font-mono text-[9px]">
              {(scrubIndex ?? trace.events.length - 1) + 1}/{trace.events.length}
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
          </div>
        )}
      </div>

      {/* Right inspector (collapsible) */}
      <div className={clsx(
        "shrink-0 transition-all duration-200 overflow-hidden rounded border border-slate-200 dark:border-indigo-900/40 bg-white/90 dark:bg-[#0a0a0a]/70 shadow-sm flex flex-col",
        normRightOpen ? "w-72" : "w-10"
      )}>
        <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-200 dark:border-indigo-900/40 bg-slate-50/50 dark:bg-indigo-950/20">
          {normRightOpen && <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">INSPECTOR</span>}
          <button
            type="button"
            onClick={() => setNormRightOpen((p) => !p)}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            title={normRightOpen ? "Collapse inspector" : "Expand inspector"}
          >
            {normRightOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRight className="h-3.5 w-3.5" />}
          </button>
        </div>
        {normRightOpen && (
          <div className="flex-1 overflow-y-auto p-3">
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
        )}
      </div>

      {/* ─── Quick-Connect Radial Search ─── */}
      {quickConnect && (
        <QuickConnectSearch
          position={quickConnect.position}
          sourceNodeId={quickConnect.sourceNodeId}
          onSelect={handleQuickConnectSelect}
          onClose={() => setQuickConnect(null)}
        />
      )}

      {/* ─── Alignment Bar ─── */}
      {selectedNodesForAlignment.length >= 2 && !inTraceMode && (
        <AlignmentBar
          selectedNodes={selectedNodesForAlignment}
          edges={edges}
          onAlign={handleAlignment}
          onDismiss={() => {
            nodes.forEach((n) => {
              if (n.selected) {
                setNodes((prev) => prev.map((p) => p.id === n.id ? { ...p, selected: false } : p));
              }
            });
          }}
        />
      )}



      {/* ─── Collaboration Overlay ─── */}
      <CollaborationOverlay
        canvasContainerRef={wrapperRef}
        viewport={viewport}
      />

      {/* ─── Export Dialog ─── */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        graph={flowToGraph(nodes, edges)}
        canvasContainerRef={wrapperRef}
      />

      {/* ─── Macro Library Panel (shown via toolbar button) ─── */}
      {showMacroLibrary && (
        <div className={clsx(
          "absolute left-2 top-16 z-20 w-64 max-h-[70vh] overflow-y-auto rounded-lg backdrop-blur-md p-3 shadow-2xl font-mono",
          canvasTheme === "paper"
            ? "border border-slate-200 bg-white/95 text-slate-800"
            : canvasTheme === "graphite"
              ? "border border-slate-600/60 bg-[#1a1d27]/95 text-slate-200"
              : "border border-slate-700/60 bg-[#0a0a14]/95 text-slate-200"
        )}>
          <MacroLibrary
            nodes={nodes}
            edges={edges}
            selectedNodeIds={new Set(nodes.filter((n) => n.selected).map((n) => n.id))}
            onAddMacro={handleAddMacro}
            isOpen={showMacroLibrary}
            onToggle={() => setShowMacroLibrary(!showMacroLibrary)}
          />
        </div>
      )}

      {/* ─── Debugger Panel ─── */}
      {showDebugger && (
        <div className={clsx(
          "absolute right-2 bottom-16 z-20 w-64 max-h-[60vh] overflow-y-auto rounded-lg backdrop-blur-md p-3 shadow-2xl",
          canvasTheme === "paper"
            ? "border border-slate-200 bg-white/95 text-slate-800"
            : canvasTheme === "graphite"
              ? "border border-slate-600/60 bg-[#1a1d27]/95 text-slate-200"
              : "border border-slate-700/60 bg-[#0a0a14]/95 text-slate-200"
        )}>
          <DebuggerPanel
            nodeStatuses={effStatuses}
            nodeDetails={effDetails}
            isRunning={inTraceMode && effExecutionStatus === "RUNNING"}
            onToggleBreakpoint={handleToggleBreakpoint}
          />
        </div>
      )}

      {/* ─── A2A Agent Directory Modal ─── */}
      <A2ADirectoryModal
        isOpen={showA2ADirectory}
        onClose={() => setShowA2ADirectory(false)}
        onSelectAgent={handleAddA2AAgentFromDirectory}
      />
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
