import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Wrench, ShieldCheck, Activity, Lock, Braces } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { createToolRegistry, getToolCategory } from "@/modules/tools";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { findToolDefinition, probeHealth } from "@/lib/tools";
import { ToolCallDTO } from "@/types/execution";
import { ToolCategory } from "@/types/tool";
import { clsx } from "clsx";

const pad = (n: number) => String(n).padStart(2, "0");

const categoryStyles: Record<ToolCategory, string> = {
  COMPUTE: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-semibold",
  SEARCH: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold",
  DATA: "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 font-semibold",
  TASK: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold",
};

const callStatusStyles: Record<string, string> = {
  SUCCESS: "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold",
  ERROR: "border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 font-semibold",
  BLOCKED: "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-semibold",
  REJECTED: "border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 font-semibold",
};

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function JsonPreview({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-semibold">{label}</div>
      <pre className="rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/60 p-3 text-[10px] text-slate-800 dark:text-slate-400 font-mono overflow-x-auto max-h-72 overflow-y-auto whitespace-pre shadow-sm">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </div>
  );
}

export default async function ToolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { userId } = await auth();
  const { name } = await params;
  const { category } = await searchParams;
  // Preserve the dashboard category filter on the back link when present.
  const backHref = category ? `/dashboard/tools?category=${category}` : "/dashboard/tools";

  const registry = createToolRegistry();
  const tool = registry.getTool(name);
  const [definition, executionRepo] = [await findToolDefinition(name), new ExecutionRepository()];

  if (!definition && !tool) notFound();

  // Recent invocations + usage are scoped to the signed-in user so tool calls
  // (which carry args/results) never leak across accounts.
  const [health, usageCounts, recentCalls] = tool && userId
    ? await Promise.all([
        probeHealth(tool),
        executionRepo.countToolCallsByTool(userId),
        executionRepo.findToolCallsByToolName(name, userId, 10),
      ])
    : ([null, {} as Record<string, number>, [] as ToolCallDTO[]] as const);

  const usage = usageCounts[name] ?? 0;
  const displayName = definition?.displayName ?? tool?.displayName ?? name;
  const categoryId = (tool?.category ?? definition?.category ?? "COMPUTE") as ToolCategory;
  const categoryMeta = getToolCategory(categoryId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-indigo-950/80 pb-5 space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 transition-colors font-semibold"
        >
          <ChevronLeft className="h-3 w-3" /> BACK TO TOOL REGISTRY
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-tight flex items-center gap-3">
            <Wrench className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            {displayName}
          </h1>
          <span className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400/80 border border-slate-300 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded font-semibold">
            {name}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono">
          <span className={clsx("px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold", categoryStyles[categoryId])}>
            {categoryMeta.label}
          </span>
          <span className={clsx("px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold", (definition?.type ?? tool?.type) === "WRITE" ? "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300" : "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300")}>
            {(definition?.type ?? tool?.type) ?? "READ"}
          </span>
          {(definition?.requiresApproval || tool?.requiresApproval) && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 uppercase tracking-wider font-semibold">
              <Lock className="h-2.5 w-2.5" /> HITL REQUIRED
            </span>
          )}
          {health && (
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold",
                health.status === "healthy"
                  ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
                  : health.status === "degraded"
                    ? "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
                    : "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300"
              )}
            >
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  health.status === "healthy" ? "bg-emerald-500" : health.status === "degraded" ? "bg-amber-500" : "bg-red-500"
                )}
              />
              {health.status} · {health.latencyMs}ms
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 uppercase tracking-wider font-semibold">
            <ShieldCheck className="h-2.5 w-2.5" /> {pad(usage)} CALLS
          </span>
        </div>

        <p className="text-[10px] font-mono text-slate-600 dark:text-slate-500 max-w-2xl leading-relaxed font-medium">
          CATEGORY · {categoryMeta.label.toUpperCase()} — {categoryMeta.description}
        </p>
        {definition?.description ?? tool?.description ? (
          <p className="text-xs text-slate-700 dark:text-slate-400 font-mono max-w-2xl leading-relaxed">
            {definition?.description ?? tool?.description}
          </p>
        ) : null}
      </div>

      {/* JSON Schemas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-4 space-y-3 shadow-sm">
          <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
            <Braces className="h-3.5 w-3.5" /> Input Schema (JSON)
          </div>
          <JsonPreview label="Accepted input shape" value={tool?.inputSchema ?? definition?.parameters ?? {}} />
        </div>
        <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-4 space-y-3 shadow-sm">
          <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
            <Braces className="h-3.5 w-3.5" /> Output Schema (JSON)
          </div>
          <JsonPreview label="Structured result shape" value={tool?.outputSchema ?? {}} />
        </div>
      </div>

      {/* Recent Calls */}
      <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-3 shadow-sm">
        <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
          <Activity className="h-3.5 w-3.5" /> Recent Invocations (last 10)
        </div>
        {recentCalls.length === 0 ? (
          <p className="text-[11px] text-slate-500">No invocations recorded yet. Run a skill that uses this tool to see its calls here.</p>
        ) : (
          <ul className="space-y-2">
            {recentCalls.map((call) => (
              <li key={call.id} className="rounded border border-slate-200 dark:border-indigo-950/60 bg-slate-50 dark:bg-black/40 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[10px] font-mono text-slate-500 font-medium">{formatDate(call.executedAt)}</span>
                  <span className="text-[11px] font-mono font-semibold text-indigo-900 dark:text-indigo-200">{call.action}</span>
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase font-semibold",
                      callStatusStyles[call.status] ?? callStatusStyles.ERROR
                    )}
                  >
                    {call.status}
                  </span>
                  {call.durationMs != null && (
                    <span className="text-[10px] font-mono text-slate-500 font-medium">{(call.durationMs / 1000).toFixed(2)}s</span>
                  )}
                  {call.errorMessage && <span className="text-[10px] font-mono text-red-600 dark:text-red-400 font-semibold">[ {call.errorMessage} ]</span>}
                </div>
                <pre className="text-[10px] text-slate-600 dark:text-slate-500 font-mono overflow-x-auto">
                  {JSON.stringify(call.inputArgs)}
                  {call.outputResult !== null && call.outputResult !== undefined
                    ? ` → ${JSON.stringify(call.outputResult).slice(0, 240)}`
                    : ""}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
