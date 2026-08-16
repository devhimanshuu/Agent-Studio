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
import { GraphNodeType, AgentGraphDefinition } from "@/types/graph";
import { CANVAS_NODE_TYPES } from "./nodeTypes";
import { canvasNodeTypes } from "./CanvasNodes";
import { NodePalette } from "./NodePalette";
import { NodeInspector } from "./NodeInspector";
import { graphToFlow, flowToGraph, createNodeFromType, nextEdgeId, CanvasNode, CanvasNodeData } from "./graphUtils";
import { useExecutionStream } from "./useExecutionStream";
import { clsx } from "clsx";
import { Workflow, GitBranch, Play, Save, Link2, X } from "lucide-react";

const labelClass = "text-[9px] font-mono uppercase tracking-widest text-indigo-600 dark:text-indigo-400/80 font-semibold";

interface AgentGraphCanvasProps {
  graph: AgentGraphDefinition | null | undefined;
  onChange: (graph: AgentGraphDefinition) => void;
  /** Live execution id — when set the canvas enters trace mode. */
  executionId?: string | null;
  readOnly?: boolean;
  /** Rendered inside the trace panel header (e.g. run control button). */
  traceHeaderExtra?: React.ReactNode;
}

function CanvasInner({
  graph,
  onChange,
  executionId,
  readOnly = false,
  traceHeaderExtra,
}: AgentGraphCanvasProps) {
  const initial = useMemo(() => graphToFlow(graph), [graph]);
  const [nodes, setNodes] = useNodesState<CanvasNode>(initial.nodes);
  const [edges, setEdges] = useEdgesState(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef<AgentGraphDefinition | null>(null);
  const trace = useExecutionStream(executionId ?? null);

  const inTraceMode = Boolean(executionId);

  // Sync external graph changes (e.g. initial fetch or reset) to local React Flow state
  useEffect(() => {
    if (graph && graph !== lastEmittedRef.current) {
      const next = graphToFlow(graph);
      setNodes(next.nodes);
      setEdges(next.edges);
    }
  }, [graph, setNodes, setEdges]);

  // Sync trace statuses onto node data (read-only trace mode).
  const traceNodes = useMemo(() => {
    if (!inTraceMode) return nodes;
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        traceStatus: trace.nodeStatuses[n.id],
        traceDetail: trace.nodeDetails[n.id],
      },
    }));
  }, [nodes, inTraceMode, trace.nodeStatuses, trace.nodeDetails]);

  // Animate + highlight edges as they are traversed during a live run.
  const traceEdges = useMemo(() => {
    if (!inTraceMode) return edges;
    return edges.map((e) => {
      const traversed = Boolean(trace.traversedEdges[e.id]);
      if (!traversed) return e;
      return {
        ...e,
        animated: true,
        style: { stroke: "#818cf8", strokeWidth: 2, ...(e.style ?? {}) },
      };
    });
  }, [edges, inTraceMode, trace.traversedEdges]);

  const notifyChange = useCallback(
    (nextNodes: CanvasNode[], nextEdges: Edge[]) => {
      if (inTraceMode) return;
      const nextGraph = flowToGraph(nextNodes, nextEdges);
      lastEmittedRef.current = nextGraph;
      onChange(nextGraph);
    },
    [inTraceMode, onChange]
  );

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
            labelStyle: { fontSize: 10, fontFamily: "monospace", fill: "#94a3b8" },
            labelBgStyle: { fill: "#0f172a", fillOpacity: 0.9 },
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

  const terminal = trace.executionStatus
    ? ["COMPLETED", "FAILED", "CANCELLED", "STEP_LIMIT_EXCEEDED"].includes(trace.executionStatus)
    : false;

  return (
    <div className="flex h-full gap-3 font-mono">
      {/* Left palette */}
      <div className="w-52 shrink-0 overflow-y-auto rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 p-3">
        <NodePalette onDragStart={onDragStart} disabled={inTraceMode} />
      </div>

      {/* Center canvas */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Trace status bar */}
        {inTraceMode && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-indigo-500/40 bg-indigo-950/40 px-3 py-2 text-[10px]">
            <div className="flex items-center gap-2 text-indigo-300">
              <span className={clsx("inline-block h-2 w-2 rounded-full", trace.connected ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
              <span className="font-bold tracking-wider">LIVE TRACE · {trace.executionStatus ?? "CONNECTING…"}</span>
              {trace.connected ? <span className="text-emerald-400">[SSE STREAM]</span> : <span className="text-amber-400">[RECONNECTING]</span>}
            </div>
            <div className="flex items-center gap-2">{traceHeaderExtra}</div>
          </div>
        )}

        <div
          ref={wrapperRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="relative flex-1 min-h-[480px] rounded border border-slate-200 dark:border-indigo-900/40 bg-[#07070d] overflow-hidden"
        >
          <ReactFlow
            nodes={traceNodes}
            edges={traceEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
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
            nodesDraggable={!inTraceMode}
            nodesConnectable={!inTraceMode}
            edgesFocusable={!inTraceMode}
            elementsSelectable={!inTraceMode}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#1e293b" />
            <Controls className="!border-slate-700 !bg-[#0b0b12] [&>button]:!border-slate-700 [&>button]:!text-slate-300" />
            <MiniMap
              pannable
              zoomable
              className="!bg-[#0b0b12] !border-slate-700"
              nodeColor={(n) => {
                const t = n.data?.traceStatus;
                if (t === "RUNNING") return "#818cf8";
                if (t === "SUCCESS") return "#34d399";
                if (t === "FAILED") return "#f87171";
                if (t === "AWAITING_APPROVAL") return "#fbbf24";
                return "#334155";
              }}
            />
          </ReactFlow>

          {/* Empty-state hint */}
          {nodes.length <= 2 && !inTraceMode && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2 font-mono">
                <Workflow className="h-8 w-8 mx-auto text-indigo-500/50" />
                <p className="text-[11px] text-slate-500">Drag agent, tool & router nodes from the palette</p>
                <p className="text-[10px] text-slate-600">Connect them to design your multi-agent architecture</p>
              </div>
            </div>
          )}

          {/* Terminal banner */}
          {terminal && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded border border-emerald-500/40 bg-emerald-950/80 px-4 py-1.5 text-[10px] font-bold tracking-widest text-emerald-300">
              ✓ EXECUTION {trace.executionStatus}
            </div>
          )}
        </div>

        {/* Live event console */}
        {inTraceMode && trace.events.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-700/60 bg-black/70 p-2 space-y-0.5 font-mono text-[9px]">
            {trace.events.slice(-40).map((ev, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-400">
                <span className="text-slate-600 shrink-0">{new Date(ev.at).toLocaleTimeString()}</span>
                <span className="text-indigo-400 shrink-0">{ev.type}</span>
                {ev.nodeId && <span className="text-slate-300 truncate">{ev.nodeId}</span>}
                {ev.detail && <span className="text-slate-500 truncate">{ev.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right inspector */}
      <div className="w-72 shrink-0 overflow-y-auto rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 p-3">
        {inTraceMode ? (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-indigo-400/80 font-bold">LIVE TRACE</div>
            <p className="text-[9px] text-slate-500 leading-relaxed">
              Canvas is locked while the agent traverses the graph. Nodes pulse while running, glow green on success,
              amber while awaiting human approval, and red on failure.
            </p>
            <div className="space-y-1 text-[9px] text-slate-400">
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" /> RUNNING</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> SUCCESS</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> AWAITING APPROVAL</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-red-400" /> FAILED</div>
            </div>
            <div className="border-t border-slate-700/60 pt-2 space-y-1.5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">STATS</div>
              <div className="flex justify-between text-[9px] text-slate-400"><span>Events received</span><span className="text-indigo-300">{trace.events.length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-400"><span>Nodes touched</span><span className="text-indigo-300">{Object.keys(trace.nodeStatuses).length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-400"><span>Status</span><span className="text-emerald-300">{trace.executionStatus ?? "—"}</span></div>
            </div>
          </div>
        ) : selectedEdge ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-indigo-400/80 font-bold flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> EDGE
              </div>
              <button
                type="button"
                onClick={deleteSelected}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-400/50 text-[9px] font-mono text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
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
                className="w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] px-2.5 py-1.5 text-[10px] text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-colors"
              />
              <p className="text-[8px] text-slate-500 leading-tight">
                Router & supervisor nodes pick the outgoing edge whose label matches their decision. Parallel nodes use{" "}
                <code className="text-teal-400">worker</code>/<code className="text-teal-400">join</code> and loop nodes use{" "}
                <code className="text-fuchsia-400">body</code>/<code className="text-fuchsia-400">exit</code> labels.
              </p>
            </div>
            <div className="border-t border-slate-700/60 pt-2 text-[9px] text-slate-500">
              {selectedEdge.source} → {selectedEdge.target}
            </div>
          </div>
        ) : selectedNode ? (
          <NodeInspector
            node={selectedNode}
            onUpdate={(patch) => updateNodeData(selectedNode.id, patch)}
            onDelete={deleteSelected}
          />
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-indigo-400/80 font-bold">INSPECTOR</div>
            <p className="text-[9px] text-slate-500 leading-relaxed">
              Select a node to configure its prompt, tools, condition, or loop count. Click an edge to rename the branch
              (router edges pick by label).
            </p>
            <div className="border-t border-slate-700/60 pt-2 space-y-1.5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">GRAPH STATS</div>
              <div className="flex justify-between text-[9px] text-slate-400"><span>Nodes</span><span className="text-indigo-300">{nodes.length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-400"><span>Edges</span><span className="text-indigo-300">{edges.length}</span></div>
              <div className="flex justify-between text-[9px] text-slate-400"><span>Branches</span><span className="text-indigo-300">{edges.filter((e) => e.label).length}</span></div>
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
