"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  RefreshCw,
  CircleDot,
  Flag,
  GitFork,
  Search,
  Code2,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Radio,
  Plus,
  Minus,
  MousePointerClick,
  Layers,
  Zap,
  Clock,
  Cpu,
  RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";

type NodeStatus = "idle" | "running" | "done";

interface NodeDef {
  id: string;
  label: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
  x: number; // in canvas coordinate pixels
  y: number;
  width: number;
  height: number;
  kind: "start" | "end" | "supervisor" | "approval" | "normal";
  prompt?: string;
  tool?: string;
  outputPreview?: string;
}

const INITIAL_NODES: NodeDef[] = [
  {
    id: "start",
    label: "START",
    badge: "ENTRY",
    icon: CircleDot,
    sub: "entry · user input payload",
    x: 40,
    y: 40,
    width: 140,
    height: 72,
    kind: "start",
    prompt: "User Input payload validated against JSON schema.",
    outputPreview: '{\n  "feature": "JWT Auth Guard",\n  "repo": "agent-studio"\n}',
  },
  {
    id: "supervisor",
    label: "SUPERVISOR",
    badge: "ROUTER·LLM",
    icon: GitFork,
    sub: "Plan & orchestrate specialist agents",
    x: 240,
    y: 40,
    width: 175,
    height: 76,
    kind: "supervisor",
    prompt: "You are the supervisor. Orchestrate: researcher → coder → approval → critic.",
    outputPreview: '{\n  "plan": ["research", "code", "approval", "verify"],\n  "decision": "route_researcher"\n}',
  },
  {
    id: "researcher",
    label: "RESEARCHER",
    badge: "AGENT",
    icon: Search,
    sub: "Search codebase & docs",
    x: 50,
    y: 200,
    width: 160,
    height: 76,
    kind: "normal",
    prompt: "Retrieve relevant authentication middleware and token schemas from repo.",
    tool: "document_search (3 docs)",
    outputPreview: '{\n  "sources": ["src/middleware.ts", "auth/jwt.ts"],\n  "relevance": 0.98\n}',
  },
  {
    id: "coder",
    label: "CODER",
    badge: "AGENT",
    icon: Code2,
    sub: "Generate clean unified diff",
    x: 440,
    y: 200,
    width: 160,
    height: 76,
    kind: "normal",
    prompt: "Implement JWT validation middleware with transient retry handling.",
    tool: "code_generator (diff mode)",
    outputPreview: "+ export async function verifyToken(req) {\n+   return jwt.verify(req.headers.auth);\n+ }",
  },
  {
    id: "approval",
    label: "APPROVAL",
    badge: "HITL·GATE",
    icon: ShieldCheck,
    sub: "Write gate · risk < 3 auto-grants",
    x: 240,
    y: 280,
    width: 165,
    height: 76,
    kind: "approval",
    prompt: "Check write permissions. Action: write_code_diff. Auto-grant if safety risk < 3.",
    outputPreview: '{\n  "action": "write_diff",\n  "riskScore": 1.2,\n  "decision": "AUTO_GRANTED"\n}',
  },
  {
    id: "critic",
    label: "CRITIC",
    badge: "AGENT",
    icon: CheckCircle2,
    sub: "Verify correctness & lint",
    x: 240,
    y: 395,
    width: 165,
    height: 76,
    kind: "normal",
    prompt: "Run linter and static verification on generated diff. Loop back if issues found.",
    outputPreview: '{\n  "syntaxValid": true,\n  "securityScan": "PASS",\n  "testsPass": true\n}',
  },
  {
    id: "end",
    label: "END",
    badge: "EXIT",
    icon: Flag,
    sub: "terminal · final output synthesis",
    x: 470,
    y: 395,
    width: 140,
    height: 72,
    kind: "end",
    prompt: "Synthesize all intermediate node artifacts into final auditable output.",
    outputPreview: '{\n  "status": "SUCCESS",\n  "pullRequest": "#412 Ready for merge",\n  "durationMs": 1820\n}',
  },
];

interface EdgeLink {
  id: string;
  source: string;
  target: string;
  label?: string;
  loop?: boolean;
  accept?: boolean;
}

const EDGE_LINKS: EdgeLink[] = [
  { id: "e1", source: "start", target: "supervisor" },
  { id: "e2", source: "supervisor", target: "researcher", label: "route" },
  { id: "e3", source: "researcher", target: "coder", label: "context" },
  { id: "e4", source: "coder", target: "approval", label: "diff" },
  { id: "e5", source: "approval", target: "critic", label: "granted" },
  { id: "e6", source: "critic", target: "supervisor", label: "loop 1/2", loop: true },
  { id: "e7", source: "critic", target: "end", label: "accept", accept: true },
];

interface TraceLogEntry {
  nodeId: string;
  stepName: string;
  type: "START" | "AGENT" | "TOOL" | "APPROVAL" | "ROUTER" | "END";
  message: string;
  latencyMs: number;
  tokens: number;
  outputSummary: string;
  cls: string;
}

const TRACE_STEPS: TraceLogEntry[] = [
  {
    nodeId: "start",
    stepName: "START · Entry Point",
    type: "START",
    message: "Payload received & validated against strict schema",
    latencyMs: 14,
    tokens: 42,
    outputSummary: 'Input: {"feature": "JWT Auth Guard", "repo": "agent-studio"}',
    cls: "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20",
  },
  {
    nodeId: "supervisor",
    stepName: "SUPERVISOR · Planning Run",
    type: "ROUTER",
    message: "Generated 4-step graph execution plan: research → code → approve → verify",
    latencyMs: 340,
    tokens: 280,
    outputSummary: "Decision: Route to [RESEARCHER] with query 'JWT authentication middleware'",
    cls: "text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/20",
  },
  {
    nodeId: "researcher",
    stepName: "RESEARCHER · Document Retrieval",
    type: "AGENT",
    message: "Retrieved 3 matching codebase files (relevance score: 0.98)",
    latencyMs: 420,
    tokens: 310,
    outputSummary: "Found: src/middleware.ts, auth/jwt.ts, config/security.ts",
    cls: "text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/20",
  },
  {
    nodeId: "coder",
    stepName: "CODER · Unified Diff Synthesis",
    type: "AGENT",
    message: "Synthesized 214 lines of clean TypeScript implementation",
    latencyMs: 580,
    tokens: 490,
    outputSummary: "Generated: export async function verifyToken(req) { ... }",
    cls: "text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/20",
  },
  {
    nodeId: "approval",
    stepName: "APPROVAL · Safety Gate Checkpoint",
    type: "APPROVAL",
    message: "HITL Gate evaluation: Risk score 1.2 < threshold 3.0 → Auto-Granted",
    latencyMs: 45,
    tokens: 65,
    outputSummary: "Security policy check PASSED with cryptographic token key",
    cls: "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/20",
  },
  {
    nodeId: "critic",
    stepName: "CRITIC · Static Verification & Review",
    type: "AGENT",
    message: "1 minor edge case detected on header parsing → triggering loop 1/2",
    latencyMs: 290,
    tokens: 220,
    outputSummary: "Feedback emitted to Supervisor: 'Handle undefined Authorization header'",
    cls: "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/20",
  },
  {
    nodeId: "supervisor",
    stepName: "SUPERVISOR · Feedback Incorporation",
    type: "ROUTER",
    message: "Incorporated Critic feedback into coder revision prompt",
    latencyMs: 210,
    tokens: 190,
    outputSummary: "Re-routed to Coder for header refinement",
    cls: "text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/20",
  },
  {
    nodeId: "coder",
    stepName: "CODER · Revision Complete",
    type: "AGENT",
    message: "Refined 206 lines with robust null-safe header parsing",
    latencyMs: 380,
    tokens: 340,
    outputSummary: "All safety checks passed in revised diff",
    cls: "text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/20",
  },
  {
    nodeId: "critic",
    stepName: "CRITIC · Final Verification",
    type: "AGENT",
    message: "Static verification PASS: 0 lint errors, 100% type safety",
    latencyMs: 180,
    tokens: 140,
    outputSummary: "Review decision: ACCEPT → Transition to END",
    cls: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20",
  },
  {
    nodeId: "end",
    stepName: "END · Final Report & Pull Request",
    type: "END",
    message: "Multi-agent run successfully finished in 2.1s (12 node visits)",
    latencyMs: 22,
    tokens: 78,
    outputSummary: "Ready for merge · Graph execution trace committed",
    cls: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20",
  },
];

const ACCENT_CLASSES: Record<NodeDef["kind"], string> = {
  start: "border-emerald-500/70 text-emerald-600 dark:text-emerald-500",
  end: "border-emerald-500/70 text-emerald-600 dark:text-emerald-500",
  supervisor: "border-violet-500/70 text-violet-600 dark:text-violet-400",
  approval: "border-amber-500/70 text-amber-600 dark:text-amber-400",
  normal: "border-indigo-500/70 text-indigo-600 dark:text-indigo-400",
};

const BADGE_CLASSES: Record<NodeDef["kind"], string> = {
  start: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/40",
  end: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/40",
  supervisor: "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/40",
  approval: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/40",
  normal: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/40",
};

export function LiveAgentCanvasDemo() {
  const [nodes, setNodes] = useState<NodeDef[]>(INITIAL_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("supervisor");
  const [activeTab, setActiveTab] = useState<"terminal" | "inspector" | "blueprint">("terminal");

  // Simulation execution state
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [logHistory, setLogHistory] = useState<TraceLogEntry[]>([]);

  // Canvas Pan and Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const terminalScrollRef = useRef<HTMLDivElement | null>(null);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll terminal log
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [logHistory]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  // Compute node status based on current simulation step
  const getNodeStatus = useCallback(
    (nodeId: string): NodeStatus => {
      if (phase === "idle" || currentStepIndex < 0) return "idle";
      const currentStep = TRACE_STEPS[currentStepIndex];
      if (phase === "running" && currentStep?.nodeId === nodeId) return "running";
      const hasExecuted = TRACE_STEPS.slice(0, currentStepIndex + 1).some((s) => s.nodeId === nodeId);
      return hasExecuted ? "done" : "idle";
    },
    [phase, currentStepIndex]
  );

  // Determine if an edge is active
  const isEdgeActive = useCallback(
    (edge: EdgeLink): boolean => {
      if (phase === "idle" || currentStepIndex < 0) return false;
      const currentStep = TRACE_STEPS[currentStepIndex];
      if (!currentStep) return false;

      // Special active mapping
      if (edge.id === "e1" && currentStepIndex >= 1) return true;
      if (edge.id === "e2" && currentStepIndex >= 2) return true;
      if (edge.id === "e3" && currentStepIndex >= 3) return true;
      if (edge.id === "e4" && currentStepIndex >= 4) return true;
      if (edge.id === "e5" && currentStepIndex >= 5) return true;
      if (edge.id === "e6" && (currentStepIndex === 5 || currentStepIndex === 6)) return true;
      if (edge.id === "e7" && currentStepIndex >= 8) return true;
      return false;
    },
    [phase, currentStepIndex]
  );

  // Determine if an edge is currently actively pulsing data right now
  const isEdgeCurrent = useCallback(
    (edge: EdgeLink): boolean => {
      if (phase !== "running" || currentStepIndex < 0) return false;
      if (edge.id === "e1" && currentStepIndex === 1) return true;
      if (edge.id === "e2" && currentStepIndex === 2) return true;
      if (edge.id === "e3" && (currentStepIndex === 3 || currentStepIndex === 7)) return true;
      if (edge.id === "e4" && currentStepIndex === 4) return true;
      if (edge.id === "e5" && (currentStepIndex === 5 || currentStepIndex === 8)) return true;
      if (edge.id === "e6" && currentStepIndex === 6) return true;
      if (edge.id === "e7" && currentStepIndex === 9) return true;
      return false;
    },
    [phase, currentStepIndex]
  );

  // Start Simulation
  const handleRunSimulation = () => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    setPhase("running");
    setCurrentStepIndex(0);
    setLogHistory([TRACE_STEPS[0]]);
    setActiveTab("terminal");
    setSelectedNodeId(TRACE_STEPS[0].nodeId);

    let step = 0;
    simTimerRef.current = setInterval(() => {
      step += 1;
      if (step < TRACE_STEPS.length) {
        setCurrentStepIndex(step);
        setSelectedNodeId(TRACE_STEPS[step].nodeId);
        setLogHistory((prev) => [...prev, TRACE_STEPS[step]]);
      } else {
        if (simTimerRef.current) clearInterval(simTimerRef.current);
        simTimerRef.current = null;
        setPhase("done");
      }
    }, 700);
  };

  // Reset Simulation
  const handleResetSimulation = () => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTimerRef.current = null;
    setPhase("idle");
    setCurrentStepIndex(-1);
    setLogHistory([]);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => Math.max(0.6, Math.min(1.6, Number((z + delta).toFixed(2)))));
  };

  // Canvas Pan Handlers
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.button !== 0 || draggingNodeId) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      // Move dragged node
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== draggingNodeId) return n;
          return {
            ...n,
            x: (e.clientX - dragOffsetRef.current.x - pan.x) / zoom,
            y: (e.clientY - dragOffsetRef.current.y - pan.y) / zoom,
          };
        })
      );
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, node: NodeDef) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    dragOffsetRef.current = {
      x: e.clientX - (node.x * zoom + pan.x),
      y: e.clientY - (node.y * zoom + pan.y),
    };
  };

  // Calculate SVG curve paths dynamically based on current node positions
  const getEdgePath = (edge: EdgeLink) => {
    const sNode = nodes.find((n) => n.id === edge.source);
    const tNode = nodes.find((n) => n.id === edge.target);
    if (!sNode || !tNode) return "";

    const sRight = sNode.x + sNode.width;
    const sCenterY = sNode.y + sNode.height / 2;
    const tLeft = tNode.x;
    const tCenterY = tNode.y + tNode.height / 2;

    if (edge.loop) {
      // Loop around the right edge back up to supervisor
      return `M ${sRight} ${sCenterY} C ${sRight + 80} ${sCenterY}, ${sRight + 80} ${tNode.y + tNode.height / 2}, ${tNode.x + tNode.width} ${tNode.y + tNode.height / 2}`;
    }

    const dx = Math.max(40, (tLeft - sRight) / 2);
    return `M ${sRight} ${sCenterY} C ${sRight + dx} ${sCenterY}, ${tLeft - dx} ${tCenterY}, ${tLeft} ${tCenterY}`;
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];
  const _activeStep = currentStepIndex >= 0 ? TRACE_STEPS[currentStepIndex] : null;

  return (
    <div className="w-full rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-white/95 dark:bg-[#07070d] font-mono shadow-xl dark:shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-950/50 overflow-hidden transition-all duration-200">
      <style>{`
        @keyframes edgeFlowSmooth {
          0% { stroke-dashoffset: 28; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes edgePulseHalo {
          0%, 100% { opacity: 0.35; stroke-width: 4px; }
          50% { opacity: 0.85; stroke-width: 6px; }
        }
        .edge-flowing-stream {
          stroke-dasharray: 8 6;
          animation: edgeFlowSmooth 0.75s linear infinite;
        }
        .edge-loop-stream {
          stroke-dasharray: 10 7;
          animation: edgeFlowSmooth 0.85s linear infinite;
        }
        .edge-halo-anim {
          animation: edgePulseHalo 1.5s ease-in-out infinite;
        }
      `}</style>

      {/* Top Main Navigation Bar */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-100/90 dark:bg-[#0a0f1e] border-b border-slate-200 dark:border-indigo-950 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="flex gap-1 sm:gap-1.5 shrink-0">
            <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-red-500/80 inline-block shadow-sm" />
            <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-amber-500/80 inline-block shadow-sm" />
            <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-emerald-500/80 inline-block shadow-sm" />
          </div>
          <span className="text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs flex items-center gap-1.5 font-semibold truncate">
            <Terminal className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">multi-agent-orchestrator.graph</span>
          </span>
          <span className="hidden md:inline-flex px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-[9px] text-indigo-700 dark:text-indigo-300 font-bold">
            INTERACTIVE RUNTIME
          </span>
        </div>

        <div className="flex items-center gap-2">
          {phase === "running" && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tracking-widest animate-pulse">
              <Radio className="h-3 w-3" /> LIVE TRACING
            </span>
          )}

          {phase !== "running" ? (
            <button
              type="button"
              onClick={handleRunSimulation}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] sm:text-xs font-semibold shadow-md shadow-indigo-500/25 transition-all cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> <span>[ RUN SIMULATION ]</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResetSimulation}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-indigo-900/60 text-[11px] sm:text-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> <span>[ RESET ]</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Split: Interactive Canvas (Left) + Telemetry & Execution Terminal (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-indigo-950/80 min-h-0">
        {/* LEFT: Full Interactive Canvas (7 Cols) */}
        <div
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDownCanvas}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={clsx(
            "lg:col-span-7 relative h-[360px] sm:h-[460px] lg:h-[520px] overflow-hidden select-none",
            "bg-slate-50/95 dark:bg-[#07070d]",
            "bg-[radial-gradient(rgba(99,102,241,0.18)_1px,transparent_1px)] [background-size:20px_20px]",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          {/* Top Canvas Status Bar */}
          <div className="absolute top-2.5 left-2.5 sm:left-3 right-2.5 sm:right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
            <div className="flex items-center gap-1.5 sm:gap-2 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/90 dark:bg-[#0a0f1e]/90 px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] shadow-sm backdrop-blur-sm">
              <span
                className={clsx(
                  "inline-block h-2 w-2 rounded-full",
                  phase === "running"
                    ? "bg-emerald-500 animate-pulse"
                    : phase === "done"
                    ? "bg-emerald-500"
                    : "bg-slate-400"
                )}
              />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {phase === "running"
                  ? "SSE TRACE RUNNING"
                  : phase === "done"
                  ? "EXECUTION COMPLETED"
                  : "READY TO RUN"}
              </span>
            </div>

            <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-white/80 dark:bg-black/60 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
              <span className="hidden sm:inline">Drag nodes · Scroll to zoom · Pan canvas</span>
              <span className="sm:hidden">Drag · Zoom · Pan</span>
            </div>
          </div>

          {/* Scaled & Translated Canvas Content Wrapper */}
          <div
            className="absolute inset-0 origin-top-left transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: "800px",
              height: "600px",
            }}
          >
            {/* Dynamic SVG Edges */}
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none"
              style={{ width: "800px", height: "600px" }}
              aria-hidden="true"
            >
              <defs>
                {/* Neon Glow Filter */}
                <filter id="edge-neon-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="packet-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* Arrow Markers */}
                <marker
                  id="canvas-arrow-default"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="canvas-arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#818cf8" />
                </marker>
                <marker
                  id="canvas-arrow-emerald"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                </marker>
                <marker
                  id="canvas-arrow-amber"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
                </marker>
              </defs>

              {EDGE_LINKS.map((edge) => {
                const active = isEdgeActive(edge);
                const isCurrent = isEdgeCurrent(edge);
                const pathD = getEdgePath(edge);

                const activeColor = edge.accept ? "#10b981" : edge.loop ? "#f59e0b" : "#6366f1";
                const markerId = active
                  ? edge.accept
                    ? "url(#canvas-arrow-emerald)"
                    : edge.loop
                    ? "url(#canvas-arrow-amber)"
                    : "url(#canvas-arrow-active)"
                  : "url(#canvas-arrow-default)";

                return (
                  <g key={edge.id} className="transition-all duration-300">
                    {/* Layer 1: Base Subtle Guide Edge */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeOpacity={active ? 0.3 : 0.45}
                      strokeLinecap="round"
                      markerEnd={markerId}
                    />

                    {/* Layer 2: Glowing Halo Aura on Active/Current Traversal */}
                    {active && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke={activeColor}
                        strokeWidth={isCurrent ? 6 : 4}
                        strokeOpacity={isCurrent ? 0.6 : 0.3}
                        filter="url(#edge-neon-glow)"
                        className={isCurrent ? "edge-halo-anim" : ""}
                      />
                    )}

                    {/* Layer 3: Smooth Animated Electric Dash Stream */}
                    {active && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke={activeColor}
                        strokeWidth={isCurrent ? 2.5 : 2}
                        strokeLinecap="round"
                        className={edge.loop ? "edge-loop-stream" : "edge-flowing-stream"}
                      />
                    )}

                    {/* Layer 4: Realistic Traveling Energy Particle Packet when edge is pulsing */}
                    {(active || isCurrent) && phase === "running" && (
                      <g filter="url(#packet-glow)">
                        {/* Outer Glow Halo Particle */}
                        <circle r="6" fill={activeColor} opacity={0.4}>
                          <animateMotion
                            dur={edge.loop ? "1.4s" : "0.9s"}
                            repeatCount="indefinite"
                            path={pathD}
                            rotate="auto"
                          />
                        </circle>
                        {/* Core Bright Energy Bead */}
                        <circle r="3.5" fill="#ffffff">
                          <animateMotion
                            dur={edge.loop ? "1.4s" : "0.9s"}
                            repeatCount="indefinite"
                            path={pathD}
                            rotate="auto"
                          />
                        </circle>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Draggable Interactive Nodes */}
            {nodes.map((node) => {
              const status = getNodeStatus(node.id);
              const isSelected = selectedNodeId === node.id;
              const showTarget = node.kind !== "start";
              const showSource = node.kind !== "end";

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                  }}
                  className={clsx(
                    "absolute z-10 rounded-lg border font-mono transition-all duration-150 cursor-grab active:cursor-grabbing select-none",
                    "bg-white dark:bg-[#0b0b12]/95",
                    ACCENT_CLASSES[node.kind],
                    isSelected ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20 scale-[1.02]" : "shadow-sm",
                    status === "running" && "ring-2 ring-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.55)] animate-pulse",
                    status === "done" && "border-emerald-500 dark:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                  )}
                >
                  {/* Left Target Handle */}
                  {showTarget && (
                    <span className="absolute -left-[5px] top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-indigo-500 dark:bg-indigo-400 border border-white dark:border-black shadow-sm" />
                  )}
                  {/* Right Source Handle */}
                  {showSource && (
                    <span className="absolute -right-[5px] top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 border border-white dark:border-black shadow-sm" />
                  )}

                  <div className="p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <node.icon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="text-[10px] font-bold tracking-wider uppercase text-slate-900 dark:text-slate-100 truncate">
                          {node.label}
                        </span>
                      </div>
                      <span className={clsx("px-1.5 py-0.5 rounded border text-[8px] font-bold tracking-wider shrink-0", BADGE_CLASSES[node.kind])}>
                        {node.badge}
                      </span>
                    </div>
                    <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
                      {node.sub}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Canvas Floating Controls (Zoom In, Zoom Out, Reset, Fit) */}
          <div className="absolute left-3 bottom-3 z-20 flex flex-col overflow-hidden rounded-md border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0b0b12]/95 shadow-md">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
              title="Zoom In"
              aria-label="Zoom In"
              className="flex h-7 w-7 items-center justify-center border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="flex h-7 w-7 items-center justify-center border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              title="Reset View"
              aria-label="Reset View"
              className="flex h-7 w-7 items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* MiniMap Viewport Preview */}
          <div className="absolute right-3 bottom-3 z-20 h-20 w-32 rounded-md border border-slate-300 dark:border-slate-700/80 bg-white/95 dark:bg-[#0b0b12]/95 p-1.5 shadow-md hidden sm:block">
            <div className="text-[7px] text-slate-400 uppercase font-bold tracking-widest mb-1 flex items-center justify-between">
              <span>MINIMAP</span>
              <span>{(zoom * 100).toFixed(0)}%</span>
            </div>
            <svg viewBox="0 0 700 500" className="h-12 w-full" aria-hidden="true">
              {nodes.map((n) => {
                const s = getNodeStatus(n.id);
                const fill = s === "running" ? "#818cf8" : s === "done" ? "#34d399" : "#64748b";
                return (
                  <rect
                    key={n.id}
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    rx={6}
                    fill={fill}
                    opacity={selectedNodeId === n.id ? 1 : 0.7}
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {/* RIGHT: Live Execution Terminal & Node Inspector Panel (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col h-[440px] sm:h-[520px] bg-white dark:bg-[#0a0a0f] font-mono">
          {/* Panel Header with Switchable Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-[#0a0f1e]/60 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("terminal")}
                className={clsx(
                  "px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1",
                  activeTab === "terminal"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                )}
              >
                <Terminal className="h-3 w-3" />
                <span>TRACE STREAM</span>
                {phase === "running" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("inspector")}
                className={clsx(
                  "px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1",
                  activeTab === "inspector"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                )}
              >
                <Cpu className="h-3 w-3" />
                <span>NODE INSPECTOR</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("blueprint")}
                className={clsx(
                  "px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1",
                  activeTab === "blueprint"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                )}
              >
                <Layers className="h-3 w-3" />
                <span>SPEC</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Real-time Execution Trace & Terminal Log */}
          {activeTab === "terminal" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div
                ref={terminalScrollRef}
                className="flex-1 p-3 overflow-y-auto space-y-2 font-mono text-[10px] leading-relaxed bg-slate-900 text-slate-200 dark:bg-black/70"
              >
                {logHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500">
                    <Terminal className="h-8 w-8 text-indigo-400/60 animate-pulse" />
                    <p className="font-semibold text-slate-400">Execution Telemetry Stream Idle</p>
                    <p className="text-[9px] max-w-xs text-slate-500">
                      Press <span className="text-indigo-400 font-bold">[ RUN SIMULATION ]</span> above to trace real-time agent execution across the canvas.
                    </p>
                  </div>
                ) : (
                  logHistory.map((step, idx) => (
                    <div
                      key={idx}
                      className={clsx(
                        "p-2.5 rounded border transition-all duration-150 space-y-1",
                        step.cls
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold tracking-wider uppercase flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-current inline-block" />
                          {step.stepName}
                        </span>
                        <span className="text-[9px] font-mono opacity-80 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          +{step.latencyMs}ms
                        </span>
                      </div>
                      <p className="text-[9px] opacity-90">{step.message}</p>
                      {step.outputSummary && (
                        <div className="pt-1 text-[8px] font-mono opacity-75 truncate border-t border-current/20">
                          {step.outputSummary}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Execution Summary Metrics Strip */}
              <div className="p-3 border-t border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-[#0a0f1e]/80 grid grid-cols-4 gap-2 text-center text-[9px] font-mono">
                <div>
                  <div className="text-slate-400 text-[8px]">TIME</div>
                  <div className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {phase === "running" ? `${((currentStepIndex + 1) * 0.25).toFixed(1)}s` : phase === "done" ? "2.1s" : "0.0s"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[8px]">VISITS</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {Math.max(0, currentStepIndex + 1)}/10
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[8px]">LOOPS</div>
                  <div className="font-bold text-amber-600 dark:text-amber-400">
                    {currentStepIndex >= 5 ? "1/2" : "0/2"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[8px]">TOKENS</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    {logHistory.reduce((sum, s) => sum + s.tokens, 0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Selected Node Inspector */}
          {activeTab === "inspector" && (
            <div className="flex-1 p-4 overflow-y-auto space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-indigo-950">
                <div className="flex items-center gap-2">
                  <selectedNode.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    {selectedNode.label}
                  </span>
                </div>
                <span className={clsx("px-2 py-0.5 rounded border text-[9px] font-bold", BADGE_CLASSES[selectedNode.kind])}>
                  {selectedNode.badge}
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-[9px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-bold">
                  PROMPT / DIRECTIVE
                </div>
                <div className="p-2.5 rounded border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/60 text-[10px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedNode.prompt}
                </div>
              </div>

              {selectedNode.tool && (
                <div className="space-y-1">
                  <div className="text-[9px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-bold">
                    ATTACHED TOOL
                  </div>
                  <div className="p-2 rounded border border-cyan-200 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/20 text-[10px] text-cyan-800 dark:text-cyan-300 font-bold flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    {selectedNode.tool}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-[9px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-bold">
                  NODE OUTPUT ARTIFACT
                </div>
                <pre className="p-2.5 rounded border border-slate-200 dark:border-indigo-900/50 bg-slate-900 text-slate-200 dark:bg-black p-2 text-[9px] overflow-x-auto whitespace-pre font-mono">
                  {selectedNode.outputPreview}
                </pre>
              </div>

              <div className="pt-2 text-[9px] text-slate-500">
                Click any node on the left canvas to inspect its configuration and runtime telemetry.
              </div>
            </div>
          )}

          {/* TAB 3: Architecture Blueprint & Specifications */}
          {activeTab === "blueprint" && (
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-[11px] leading-relaxed">
              <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-bold flex items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-indigo-950">
                <MousePointerClick className="h-3.5 w-3.5" /> SPECIFICATION & CAPABILITIES
              </div>
              <ul className="text-slate-600 dark:text-slate-400 space-y-2.5 text-[10px]">
                <li>
                  <strong className="text-slate-900 dark:text-slate-200">1. Drag & Drop Graph Authoring:</strong> Wire agent, supervisor, tool, router, approval, and loop nodes with typed handles.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-slate-200">2. SSE Live Tracing:</strong> Watch real-time execution pulses stream with animated edges and auto-scroll telemetry.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-slate-200">3. Conditional Routing & Loops:</strong> Self-correcting feedback loops (like Critic → Supervisor) until quality criteria pass.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-slate-200">4. HITL Safety Gates:</strong> Single-use cryptographic approval keys pause execution for sensitive write operations.
                </li>
              </ul>

              <div className="pt-2 border-t border-slate-200 dark:border-indigo-950">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-2 font-bold">CLICK TO FOCUS NODE:</div>
                <div className="flex flex-wrap gap-1.5">
                  {nodes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setSelectedNodeId(n.id);
                        setActiveTab("inspector");
                      }}
                      className={clsx(
                        "px-2 py-0.5 rounded border text-[8px] font-bold uppercase transition-all cursor-pointer",
                        selectedNodeId === n.id
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-indigo-400"
                      )}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom SSE Stream Status Strip */}
      <div className="px-4 py-2 bg-slate-100 dark:bg-[#07070d] border-t border-slate-200 dark:border-indigo-950 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-600 dark:text-slate-400 font-mono">
        <span className="flex items-center gap-1.5">
          <Radio className={clsx("h-3 w-3", phase === "running" ? "text-emerald-500 animate-pulse" : "text-slate-400")} />
          <span>SSE STREAM: {phase === "running" ? "ACTIVE · 120ms TICK" : phase === "done" ? "COMPLETED" : "IDLE"}</span>
        </span>
        <span className="flex items-center gap-2">
          <span>NODES: {nodes.length}</span>
          <span>·</span>
          <span>EDGES: {EDGE_LINKS.length}</span>
          <span>·</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">ENGINE: V2 GRAPH RUNTIME</span>
        </span>
      </div>
    </div>
  );
}

