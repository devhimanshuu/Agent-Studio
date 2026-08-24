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
  Clock,
  Radio,
  Rss,
  FileText,
  Send,
  Binary,
  Search,
  FileSpreadsheet,
  FileCheck,
  HardDrive,
  Database,
  BrainCircuit,
  Mic,
  Volume2,
  Check,
  X,
  Loader2,
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
        "relative w-[230px] rounded-xl border bg-white/95 dark:bg-[#0c0d18]/95 font-mono shadow-md dark:shadow-xl dark:shadow-black/50 transition-all duration-150 canvas-node",
        accentClass,
        statusClasses(data.traceStatus) || heatmapClasses(data.heatmapLatency, data.heatmapMax),
        selected && "ring-2 ring-indigo-500/80 dark:ring-indigo-400/80 shadow-indigo-500/20"
      )}
    >
      {showTarget && <Handle type="target" position={Position.Left} className="!bg-indigo-500 dark:!bg-indigo-400 !border-0 !w-2.5 !h-2.5 shadow-sm" />}
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
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1 ${
            toolCall.status === "SUCCESS"
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50"
              : toolCall.status === "RUNNING"
                ? "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700/50"
                : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50"
          }`}>
            {toolCall.status === "RUNNING" ? (
              <>
                <Loader2 className="h-2 w-2 animate-spin" /> executing
              </>
            ) : toolCall.status === "SUCCESS" ? (
              <>
                <Check className="h-2 w-2" /> {toolCall.toolName}
              </>
            ) : (
              <>
                <X className="h-2 w-2" /> failed
              </>
            )}
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
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1 ${
            approval.decision === "APPROVED"
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50"
              : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50"
          }`}>
            {approval.decision === "APPROVED" ? (
              <>
                <Check className="h-2 w-2" /> APPROVED
              </>
            ) : (
              <>
                <X className="h-2 w-2" /> DENIED
              </>
            )}
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
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1 ${
            loopState.exited
              ? "bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50"
              : "bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-700/50"
          }`}>
            {loopState.exited ? (
              <>
                <Check className="h-2 w-2" /> exited
              </>
            ) : (
              `${loopState.iteration}/${loopState.maxIterations}`
            )}
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

function ScheduleTriggerNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.schedule_trigger;
  return (
    <BaseShell
      data={data}
      icon={<Clock className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={meta.tag}
      selected={selected}
      showTarget={false}
    >
      <div className="text-[9px] text-blue-600 dark:text-blue-400 font-bold truncate">
        {data.cronExpression ?? "0 9 * * *"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">
        {data.scheduleInterval ?? "Recurrent execution"}
      </div>
    </BaseShell>
  );
}

function WebhookTriggerNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.webhook_trigger;
  return (
    <BaseShell
      data={data}
      icon={<Radio className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={data.webhookMethod ?? "POST"}
      selected={selected}
      showTarget={false}
    >
      <div className="text-[9px] text-purple-600 dark:text-purple-400 font-bold truncate">
        {data.webhookPath ?? "/api/webhooks/incoming"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Inbound event listener
      </div>
    </BaseShell>
  );
}

function RssFeedNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.rss_feed;
  return (
    <BaseShell
      data={data}
      icon={<Rss className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={`${data.rssMaxItems ?? 10} ITEMS`}
      selected={selected}
    >
      <div className="text-[9px] text-orange-600 dark:text-orange-400 font-semibold truncate">
        {data.rssUrl ?? "RSS / Atom Stream"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Autonomous feed ingestion
      </div>
    </BaseShell>
  );
}

function WebReaderNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.web_reader;
  return (
    <BaseShell
      data={data}
      icon={<FileText className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge="MARKDOWN"
      selected={selected}
    >
      <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
        {data.readerUrl ?? "https://r.jina.ai/..."}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Jina Reader AI parser
      </div>
    </BaseShell>
  );
}

function NotificationDispatcherNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.notification_dispatcher;
  const dest = (data.dispatchDestination ?? "discord").toUpperCase();
  return (
    <BaseShell
      data={data}
      icon={<Send className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={dest}
      selected={selected}
    >
      <div className="text-[9px] text-sky-600 dark:text-sky-400 font-semibold truncate">
        {data.dispatchWebhookUrl ? "Webhook Configured" : "Outgoing Dispatcher"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">
        {data.dispatchMessage?.slice(0, 32) || "Alert delivery"}
      </div>
    </BaseShell>
  );
}

function DataMapperNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.data_mapper;
  const keyCount = data.mapperSchema ? Object.keys(data.mapperSchema).length : 0;
  return (
    <BaseShell
      data={data}
      icon={<Binary className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={`${keyCount} FIELDS`}
      selected={selected}
    >
      <div className="text-[9px] text-pink-600 dark:text-pink-400 font-semibold truncate">
        {keyCount > 0 ? Object.keys(data.mapperSchema ?? {}).slice(0, 3).join(", ") : "JSON Transform"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Schema mapper
      </div>
    </BaseShell>
  );
}

// ─── Open-Source Microservice & Tool Nodes ───

function SearxngNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.searxng_search;
  return (
    <BaseShell
      data={data}
      icon={<Search className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge="OPEN SEARCH"
      selected={selected}
    >
      <div className="text-[9px] text-sky-600 dark:text-sky-400 font-semibold truncate">
        {data.searxngQuery || "Web Query"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">
        {data.searxngHost || "https://searx.be"}
      </div>
    </BaseShell>
  );
}

function Crawl4AiNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.crawl4ai_scrape;
  return (
    <BaseShell
      data={data}
      icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge="AI CRAWLER"
      selected={selected}
    >
      <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
        {data.crawl4aiUrl || "Target URL"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Markdown Extractor
      </div>
    </BaseShell>
  );
}

function DoclingNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.docling_pdf_parser;
  return (
    <BaseShell
      data={data}
      icon={<FileCheck className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge="DOCLING · IBM"
      selected={selected}
    >
      <div className="text-[9px] text-cyan-600 dark:text-cyan-400 font-semibold truncate">
        {data.doclingDocumentUrl ? data.doclingDocumentUrl.split("/").pop() : "Document / PDF"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Table & Text Parser
      </div>
    </BaseShell>
  );
}

function GotenbergNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.gotenberg_pdf_exporter;
  return (
    <BaseShell
      data={data}
      icon={<FileOutput className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge="PDF EXPORTER"
      selected={selected}
    >
      <div className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold truncate">
        {data.gotenbergPaperSize || "A4"} · {data.gotenbergLandscape ? "Landscape" : "Portrait"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Gotenberg PDF Engine
      </div>
    </BaseShell>
  );
}

function NocodbNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.nocodb_record;
  return (
    <BaseShell
      data={data}
      icon={<Database className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={(data.nocodbOperation || "CREATE").toUpperCase()}
      selected={selected}
    >
      <div className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold truncate">
        {data.nocodbTableId || "Table ID"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">
        {data.nocodbHost || "NocoDB API"}
      </div>
    </BaseShell>
  );
}

function PocketbaseNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.pocketbase_store;
  return (
    <BaseShell
      data={data}
      icon={<HardDrive className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge={(data.pocketbaseAction || "STORE").toUpperCase()}
      selected={selected}
    >
      <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
        {data.pocketbaseCollection || "Collection"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        State & KV Persistence
      </div>
    </BaseShell>
  );
}

function QdrantNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.qdrant_vector_memory;
  return (
    <BaseShell
      data={data}
      icon={<BrainCircuit className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge="VECTOR RAG"
      selected={selected}
    >
      <div className="text-[9px] text-purple-600 dark:text-purple-400 font-semibold truncate">
        {data.qdrantCollection || "Collection"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Top {data.qdrantTopK ?? 3} Recall
      </div>
    </BaseShell>
  );
}

function AudioTranscriberNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.audio_transcriber;
  return (
    <BaseShell
      data={data}
      icon={<Mic className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge="WHISPER"
      selected={selected}
    >
      <div className="text-[9px] text-violet-600 dark:text-violet-400 font-semibold truncate">
        {data.audioSourceUrl ? "Audio Stream" : "Audio Input"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Lang: {data.audioLanguage || "Auto"}
      </div>
    </BaseShell>
  );
}

function PiperTtsNode({ data, selected }: NodePropsShape) {
  const meta = CANVAS_NODE_TYPE_MAP.piper_tts;
  return (
    <BaseShell
      data={data}
      icon={<Volume2 className="h-3.5 w-3.5" />}
      accentClass={meta.accent}
      badgeClass={meta.badgeClass}
      badge="PIPER TTS"
      selected={selected}
    >
      <div className="text-[9px] text-teal-600 dark:text-teal-400 font-semibold truncate">
        {data.piperVoice || "Default Voice"}
      </div>
      <div className="text-[8px] text-slate-500 dark:text-slate-400">
        Local Speech Synthesis
      </div>
    </BaseShell>
  );
}

// ─── Sticky Note (Markdown Documentation) ───

const NOTE_COLORS: Record<string, string> = {
  yellow: "bg-amber-500/10 border-amber-400/50 text-amber-900 dark:text-amber-200",
  pink: "bg-pink-500/10 border-pink-400/50 text-pink-900 dark:text-pink-200",
  blue: "bg-blue-500/10 border-blue-400/50 text-blue-900 dark:text-blue-200",
  green: "bg-emerald-500/10 border-emerald-400/50 text-emerald-900 dark:text-emerald-200",
  purple: "bg-purple-500/10 border-purple-400/50 text-purple-900 dark:text-purple-200",
};

function StickyNoteNode({ data, selected }: NodePropsShape) {
  const color = (data.noteColor as string) ?? "yellow";
  const content = (data.noteContent as string) ?? "# Notes\nAdd documentation here...";
  return (
    <div
      className={clsx(
        "relative w-[260px] max-w-[320px] rounded-xl border backdrop-blur-md font-mono shadow-md p-3.5 min-h-[100px] transition-all",
        NOTE_COLORS[color] || NOTE_COLORS.yellow,
        selected && "ring-2 ring-indigo-500/80 dark:ring-indigo-400/80"
      )}
    >
      <div className="flex items-center gap-1.5 mb-2 border-b border-black/5 dark:border-white/10 pb-1.5">
        <StickyNote className="h-3.5 w-3.5 opacity-80" />
        <span className="text-[10px] font-bold uppercase tracking-wider truncate">
          {data.label || "NOTE"}
        </span>
      </div>
      <div className="text-[10px] opacity-90 whitespace-pre-wrap leading-relaxed line-clamp-6">
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
  schedule_trigger: memo(ScheduleTriggerNode),
  webhook_trigger: memo(WebhookTriggerNode),
  rss_feed: memo(RssFeedNode),
  web_reader: memo(WebReaderNode),
  notification_dispatcher: memo(NotificationDispatcherNode),
  data_mapper: memo(DataMapperNode),
  searxng_search: memo(SearxngNode),
  crawl4ai_scrape: memo(Crawl4AiNode),
  docling_pdf_parser: memo(DoclingNode),
  gotenberg_pdf_exporter: memo(GotenbergNode),
  nocodb_record: memo(NocodbNode),
  pocketbase_store: memo(PocketbaseNode),
  qdrant_vector_memory: memo(QdrantNode),
  audio_transcriber: memo(AudioTranscriberNode),
  piper_tts: memo(PiperTtsNode),
  sticky_note: memo(StickyNoteNode),
  frame: memo(FrameNode),
};
