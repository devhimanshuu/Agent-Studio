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
  ServerCog,
  Plug,
  Puzzle,
  Globe,
  Shuffle,
  Timer,
  Layers,
  Variable,
  FileOutput,
  StickyNote,
  Frame,
} from "lucide-react";
import { clsx } from "clsx";
import { CANVAS_NODE_TYPE_MAP } from "./nodeTypes";
import type { CanvasNodeData } from "./graphUtils";

interface NodePropsShape {
  data: CanvasNodeData;
  selected?: boolean;
}

/** Live trace status → animation class. */
function statusClasses(status: CanvasNodeData["traceStatus"]): string {
  switch (status) {
    case "RUNNING":
      return "canvas-node-running";
    case "SUCCESS":
      return "canvas-node-success";
    case "FAILED":
      return "canvas-node-failed";
    case "AWAITING_APPROVAL":
      return "canvas-node-awaiting";
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
  showSource: _showSource = true,
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
        "relative w-full rounded border bg-white dark:bg-[#0b0b12]/95 font-mono shadow-md dark:shadow-xl canvas-node",
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
  const llmCall = data.traceLlmCall as { model?: string; inputTokens?: number; outputTokens?: number; durationMs?: number } | undefined;
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
      {llmCall && (
        <div className="flex items-center gap-1.5 mt-1 text-[7px] text-slate-400">
          {llmCall.model && <span className="text-indigo-500 dark:text-indigo-400 font-semibold">{llmCall.model}</span>}
          {llmCall.inputTokens !== undefined && (
            <span>↑{llmCall.inputTokens}</span>
          )}
          {llmCall.outputTokens !== undefined && (
            <span>↓{llmCall.outputTokens}</span>
          )}
          {llmCall.durationMs !== undefined && (
            <span>{llmCall.durationMs}ms</span>
          )}
        </div>
      )}
    </BaseShell>
  );
}

function SupervisorNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.supervisor;
  const llmCall = data.traceLlmCall as { model?: string; inputTokens?: number; outputTokens?: number; durationMs?: number } | undefined;
  const decision = data.traceRouterDecision as { chosenLabel: string; mode: string; reason?: string } | undefined;
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
      {llmCall && (
        <div className="flex items-center gap-1.5 mt-1 text-[7px] text-slate-400">
          {llmCall.model && <span className="text-violet-500 dark:text-violet-400 font-semibold">{llmCall.model}</span>}
          {llmCall.inputTokens !== undefined && <span>↑{llmCall.inputTokens}</span>}
          {llmCall.outputTokens !== undefined && <span>↓{llmCall.outputTokens}</span>}
        </div>
      )}
      {decision && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-bold border border-violet-200 dark:border-violet-700/50">
            → {decision.chosenLabel || "default"}
          </span>
        </div>
      )}
    </BaseShell>
  );
}

function ToolNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.tool;
  const toolCall = data.traceToolCall as { toolName: string; action?: string; durationMs?: number; status: string } | undefined;
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
      {toolCall && (
        <div className="flex items-center gap-1 mt-1">
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border ${
            toolCall.status === "SUCCESS"
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50"
              : toolCall.status === "RUNNING"
                ? "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700/50"
                : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50"
          }`}>
            {toolCall.status === "RUNNING" ? "⏳ executing" : toolCall.status === "SUCCESS" ? `✓ ${toolCall.toolName}` : `✗ failed`}
          </span>
          {toolCall.durationMs !== undefined && (
            <span className="text-[7px] text-slate-400">{toolCall.durationMs}ms</span>
          )}
        </div>
      )}
    </BaseShell>
  );
}

function RouterNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.router;
  const decision = data.traceRouterDecision as { chosenLabel: string; mode: string; reason?: string } | undefined;
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
      {decision && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-700/50">
            → {decision.chosenLabel || "default"}
          </span>
          {decision.reason && (
            <span className="text-[7px] text-slate-400 truncate max-w-[80px]" title={decision.reason}>
              {decision.reason}
            </span>
          )}
        </div>
      )}
    </BaseShell>
  );
}

function ApprovalNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.approval;
  const approval = data.traceApproval as { reason?: string; action?: string; decision?: string } | undefined;
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
      {approval?.decision && (
        <div className="flex items-center gap-1 mt-1">
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border ${
            approval.decision === "APPROVED"
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50"
              : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50"
          }`}>
            {approval.decision === "APPROVED" ? "✓ APPROVED" : "✗ DENIED"}
          </span>
        </div>
      )}
    </BaseShell>
  );
}

function LoopNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.loop;
  const loopState = data.traceLoopState as { iteration: number; maxIterations: number; exited: boolean } | undefined;
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
      {loopState && (
        <div className="flex items-center gap-1 mt-1">
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border ${
            loopState.exited
              ? "bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50"
              : "bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-700/50"
          }`}>
            {loopState.exited ? `✓ exited` : `${loopState.iteration}/${loopState.maxIterations}`}
          </span>
        </div>
      )}
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

// ─── MCP & Ecosystem Nodes ───

function McpServerNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.mcp_server;
  return (
    <BaseShell
      data={data}
      icon={<ServerCog className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
    >
      <div className="text-[9px] text-violet-700 dark:text-violet-300 font-semibold truncate">{data.mcpServerId ?? "no server"}</div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">{data.mcpTransport ?? "SSE"} · {data.mcpEndpoint ?? "—"}</div>
    </BaseShell>
  );
}

function McpToolNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.mcp_tool;
  return (
    <BaseShell
      data={data}
      icon={<Plug className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
    >
      <div className="text-[9px] text-fuchsia-700 dark:text-fuchsia-300 font-semibold truncate">{data.mcpToolName ?? "no tool"}</div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">server: {data.mcpToolServer ?? "—"}</div>
    </BaseShell>
  );
}

function SkillNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.skill;
  return (
    <BaseShell
      data={data}
      icon={<Puzzle className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
    >
      <div className="text-[9px] text-sky-700 dark:text-sky-300 font-semibold truncate">{data.skillId || "select skill"}</div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">marketplace skill</div>
    </BaseShell>
  );
}

function HttpNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.http;
  return (
    <BaseShell
      data={data}
      icon={<Globe className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={data.httpMethod ?? "GET"}
      selected={selected}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate" title={data.httpUrl}>{data.httpUrl ?? "https://…"}</div>
    </BaseShell>
  );
}

function TransformNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.transform;
  return (
    <BaseShell
      data={data}
      icon={<Shuffle className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
    >
      <div className="text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold truncate">{data.transformOp ?? "map"}</div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">{data.transformExpr ?? "—"}</div>
    </BaseShell>
  );
}

function DelayNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.delay;
  return (
    <BaseShell
      data={data}
      icon={<Timer className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={`${(data.delayMs ?? 1000) >= 1000 ? `${(data.delayMs ?? 1000) / 1000}s` : `${data.delayMs ?? 1000}ms`}`}
      selected={selected}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400">pause execution</div>
    </BaseShell>
  );
}

function AggregateNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.aggregate;
  return (
    <BaseShell
      data={data}
      icon={<Layers className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
      sourceCount={2}
    >
      <div className="text-[9px] text-amber-700 dark:text-amber-300 font-semibold truncate">{data.aggregateMode ?? "concat"}</div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">combine branch results</div>
    </BaseShell>
  );
}

function VariableNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.variable;
  return (
    <BaseShell
      data={data}
      icon={<Variable className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={data.varOp === "set" ? "SET" : "GET"}
      selected={selected}
    >
      <div className="text-[9px] text-indigo-700 dark:text-indigo-300 font-semibold truncate">{data.varName ?? "var"}</div>
      {data.varOp === "set" && <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">{JSON.stringify(data.varValue).slice(0, 40)}</div>}
    </BaseShell>
  );
}

function OutputNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.output;
  return (
    <BaseShell
      data={data}
      icon={<FileOutput className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
      showSource={false}
    >
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">{data.outputTemplate ?? "{{ results }}"}</div>
    </BaseShell>
  );
}

// ─── Sticky Note (Markdown Documentation) ───

const NOTE_COLORS: Record<string, string> = {
  yellow: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-500/40",
  pink: "bg-pink-50 dark:bg-pink-950/30 border-pink-300 dark:border-pink-500/40",
  blue: "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-500/40",
  green: "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-500/40",
  purple: "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-500/40",
};

function StickyNoteNode({ data, selected }: NodePropsShape) {
  const color = (data.noteColor as string) ?? "yellow";
  const content = (data.noteContent as string) ?? "# Notes\nAdd documentation here...";
  return (
    <div
      className={clsx(
        "relative w-full rounded-lg border-2 border-dashed font-mono shadow-md p-3 min-h-[120px]",
        NOTE_COLORS[color] || NOTE_COLORS.yellow,
        selected && "ring-2 ring-indigo-500/70 dark:ring-indigo-400/70"
      )}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <StickyNote className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
        <span className="text-[9px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">
          {data.label}
        </span>
      </div>
      <div className="text-[9px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-6">
        {content}
      </div>
    </div>
  );
}

// ─── Frame (Visual Container / Swimlane) ───

function FrameNode({ data, selected }: NodePropsShape) {
  return (
    <div
      className={clsx(
        "relative w-full h-full rounded-lg border-2 border-dashed border-indigo-400/50 dark:border-indigo-500/40",
        "bg-indigo-50/8 dark:bg-indigo-950/15",
        selected && "ring-2 ring-indigo-500/70 dark:ring-indigo-400/70"
      )}
      style={{ minHeight: 200, minWidth: 300 }}
    >
      <div className="absolute -top-3 left-3 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 rounded border border-indigo-300 dark:border-indigo-500/40">
        <div className="flex items-center gap-1.5">
          <Frame className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
          <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
            {(data.frameTitle as string) ?? "Phase"}
          </span>
        </div>
      </div>
      {/* Frame is a visual-only container — no handles needed */}
    </div>
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
  mcp_server: memo(McpServerNode),
  mcp_tool: memo(McpToolNode),
  skill: memo(SkillNode),
  http: memo(HttpNode),
  transform: memo(TransformNode),
  delay: memo(DelayNode),
  aggregate: memo(AggregateNode),
  variable: memo(VariableNode),
  output: memo(OutputNode),
  sticky_note: memo(StickyNoteNode),
  frame: memo(FrameNode),
};
