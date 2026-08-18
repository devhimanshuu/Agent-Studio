"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  CircleDot,
  Flag,
  Bot,
  GitFork,
  Wrench,
  Split,
  ShieldCheck,
  Repeat,
  Target,
  Boxes,
} from "lucide-react";
import { clsx } from "clsx";
import { CANVAS_NODE_TYPE_MAP } from "./nodeTypes";
import type { CanvasNodeData } from "./graphUtils";

interface NodePropsShape {
  data: CanvasNodeData;
  selected?: boolean;
}

/** Live trace status → ring/pulse styling. */
function statusClasses(status: CanvasNodeData["traceStatus"]): string {
  switch (status) {
    case "RUNNING":
      return "border-indigo-400 shadow-[0_0_18px_rgba(99,102,241,0.55)] animate-pulse";
    case "SUCCESS":
      return "border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.5)]";
    case "FAILED":
      return "border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.55)]";
    case "AWAITING_APPROVAL":
      return "border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.55)] animate-pulse";
    case "SKIPPED":
      return "border-slate-500 opacity-60";
    default:
      return "";
  }
}

/** Heatmap mode: latency intensity → cool (fast) → hot (slow). */
function heatmapClasses(latency?: number, max?: number): string {
  if (latency === undefined || !max || max <= 0) return "";
  const ratio = Math.min(1, latency / max);
  if (ratio < 0.33) return "border-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.4)]";
  if (ratio < 0.66) return "border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.5)]";
  return "border-red-400 shadow-[0_0_16px_rgba(239,68,68,0.6)]";
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function statusDot(status: CanvasNodeData["traceStatus"]) {
  if (!status) return null;
  const color =
    status === "SUCCESS"
      ? "bg-emerald-400"
      : status === "FAILED"
        ? "bg-red-400"
        : status === "AWAITING_APPROVAL"
          ? "bg-amber-400"
          : "bg-indigo-400";
  return (
    <span className={clsx("inline-block h-2 w-2 rounded-full", color, status === "RUNNING" && "animate-ping")} />
  );
}

function BaseShell({
  data,
  icon,
  accentClass,
  badgeClass,
  badge,
  children,
  selected,
  showTarget = true,
  showSource = true,
  sourceCount = 1,
}: {
  data: CanvasNodeData;
  icon: React.ReactNode;
  accentClass: string;
  badgeClass: string;
  badge: string;
  children?: React.ReactNode;
  selected?: boolean;
  showTarget?: boolean;
  showSource?: boolean;
  sourceCount?: number;
}) {
  return (
    <div
      className={clsx(
        "relative w-full rounded border bg-white dark:bg-[#0b0b12]/95 font-mono shadow-md dark:shadow-xl transition-all duration-200",
        accentClass,
        statusClasses(data.traceStatus) || heatmapClasses(data.heatmapLatency, data.heatmapMax),
        selected && "ring-2 ring-indigo-500/70 dark:ring-indigo-400/70"
      )}
    >
      {showTarget && <Handle type="target" position={Position.Left} className="!bg-indigo-500 dark:!bg-indigo-400 !border-0 !w-2.5 !h-2.5" />}
      {Array.from({ length: Math.max(1, sourceCount) }).map((_, i) => (
        <Handle
          key={i}
          type="source"
          id={sourceCount > 1 ? `src-${i}` : undefined}
          position={Position.Right}
          style={sourceCount > 1 ? { top: `${((i + 1) * 100) / (sourceCount + 1)}%` } : undefined}
          className="!bg-emerald-500 dark:!bg-emerald-400 !border-0 !w-2.5 !h-2.5"
        />
      ))}

      <div className="p-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-indigo-600 dark:text-indigo-400 shrink-0">{icon}</span>
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-800 dark:text-slate-100 truncate">
              {data.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {statusDot(data.traceStatus)}
            <span className={clsx("px-1.5 py-0.5 rounded border text-[8px] font-bold tracking-wider", badgeClass)}>
              {badge}
            </span>
          </div>
        </div>
        {children}
        {data.heatmapLatency !== undefined && data.heatmapMax !== undefined && data.heatmapMax > 0 && (
          <div className="text-[8px] font-bold text-slate-500 dark:text-slate-400 truncate">
            ⏱ {formatMs(data.heatmapLatency)}
          </div>
        )}
        {data.traceDetail && (
          <div className="text-[8px] text-slate-600 dark:text-slate-400 leading-tight truncate" title={data.traceDetail}>
            {data.traceDetail}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.agent;
  const promptPreview = (data.prompt ?? "").slice(0, 80);
  return (
    <BaseShell
      data={data}
      icon={<Bot className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2" title={data.prompt}>
        {promptPreview || "No prompt configured"}
      </div>
    </BaseShell>
  );
}

function SupervisorNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.supervisor;
  return (
    <BaseShell
      data={data}
      icon={<GitFork className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
      sourceCount={Math.max(1, 2)}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2" title={data.prompt}>
        {(data.prompt ?? "No prompt configured").slice(0, 80)}
      </div>
    </BaseShell>
  );
}

function ToolNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.tool;
  return (
    <BaseShell
      data={data}
      icon={<Wrench className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
    >
      <div className="text-[9px] text-cyan-700 dark:text-cyan-300 font-semibold truncate">{data.toolName ?? "no tool selected"}</div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">action · {data.action ?? "—"}</div>
    </BaseShell>
  );
}

function RouterNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.router;
  return (
    <BaseShell
      data={data}
      icon={<Split className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={data.routerMode === "ai" ? "ROUTER·AI" : "ROUTER·COND"}
      selected={selected}
      sourceCount={2}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2" title={data.condition}>
        {data.routerMode === "ai" ? (data.routerPrompt ?? "AI router — model picks branch") : (data.condition ?? "no condition")}
      </div>
    </BaseShell>
  );
}

function ApprovalNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.approval;
  return (
    <BaseShell
      data={data}
      icon={<ShieldCheck className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2" title={data.approvalReason}>
        {data.approvalReason ?? "No reason configured"}
      </div>
    </BaseShell>
  );
}

function LoopNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.loop;
  return (
    <BaseShell
      data={data}
      icon={<Repeat className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={`LOOP · ${data.maxIterations ?? 3}×`}
      selected={selected}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400">repeats body edge, then exits</div>
    </BaseShell>
  );
}

function ParallelNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.parallel;
  return (
    <BaseShell
      data={data}
      icon={<Target className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={data.parallelMode === "map" ? "MAP" : "FAN-OUT"}
      selected={selected}
      sourceCount={data.parallelMode === "map" ? 2 : 3}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">
        {data.parallelMode === "map" ? `map ${data.mapField ?? "input.items"}` : "fan-out branches"}
      </div>
    </BaseShell>
  );
}

function StartNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.start;
  return (
    <BaseShell
      data={data}
      icon={<CircleDot className="h-4 w-4" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
      showTarget={false}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400">entry · user input</div>
    </BaseShell>
  );
}

function SubgraphNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.subgraph;
  const inner = data.subgraph;
  const innerNodes = inner?.nodes?.length ?? 0;
  const innerEdges = inner?.edges?.length ?? 0;
  return (
    <BaseShell
      data={data}
      icon={<Boxes className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400 leading-tight">
        {innerNodes > 0 ? `${innerNodes} inner nodes · ${innerEdges} edges` : "empty macro — open & build it"}
      </div>
      <div className="text-[8px] text-slate-400 dark:text-slate-500 truncate">
        in {Object.keys(data.inputMapping ?? {}).length} · out {Object.keys(data.outputMapping ?? {}).length}
      </div>
    </BaseShell>
  );
}

function EndNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.end;
  return (
    <BaseShell
      data={data}
      icon={<Flag className="h-4 w-4" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
      showSource={false}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400">terminal · final output</div>
    </BaseShell>
  );
}

export const canvasNodeTypes = {
  start: memo(StartNode),
  end: memo(EndNode),
  agent: memo(AgentNode),
  supervisor: memo(SupervisorNode),
  tool: memo(ToolNode),
  router: memo(RouterNode),
  approval: memo(ApprovalNode),
  loop: memo(LoopNode),
  parallel: memo(ParallelNode),
  subgraph: memo(SubgraphNode),
};
