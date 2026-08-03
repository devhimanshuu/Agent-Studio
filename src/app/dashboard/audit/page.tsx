"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, ShieldCheck, Filter } from "lucide-react";
import { auditApi, AuditFilters } from "@/lib/api/audit";
import { SkeletonTable } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shortId(id?: string | null): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

const actionStyles: Record<string, string> = {
  SKILL_CREATED: "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold",
  SKILL_UPDATED: "border-indigo-400 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-semibold",
  SKILL_PUBLISHED: "border-violet-400 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 font-semibold",
  SKILL_ARCHIVED: "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold",
  SKILL_DELETED: "border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 font-semibold",
  EXECUTION_STARTED: "border-cyan-400 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 font-semibold",
  EXECUTION_COMPLETED: "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold",
  EXECUTION_FAILED: "border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 font-semibold",
  EXECUTION_CANCELLED: "border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-400 font-medium",
  EXECUTION_REPLAYED: "border-cyan-400 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 font-semibold",
  APPROVAL_REQUESTED: "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold",
  APPROVAL_APPROVED: "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold",
  APPROVAL_REJECTED: "border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 font-semibold",
  TOOL_EXECUTED: "border-indigo-400 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-semibold",
};

function actionStyle(action: string): string {
  return actionStyles[action] ?? "border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-400 font-medium";
}

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [action, setAction] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filters: AuditFilters = {
    search: debounced || undefined,
    action: action || undefined,
    limit: 200,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit", debounced, action],
    queryFn: () => auditApi.list(filters),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const payload = await auditApi.export(filters);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Audit log exported", `${payload.count} entries`);
    } catch (e) {
      toast.error("Export failed", e instanceof Error ? e.message : undefined);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            AUDIT LOG
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
            Every significant action — skills, executions, approvals, tools — recorded with a timestamp.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || !data?.length}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-emerald-400 bg-emerald-600 text-white text-xs font-mono font-semibold hover:bg-emerald-500 shadow-md shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          [ EXPORT JSON ]
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 font-mono">
        <label className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action or execution id…"
            className="w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-black/50 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/70 font-semibold">
          <Filter className="h-3 w-3" />
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-black/50 px-3 py-2 text-xs text-slate-900 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
            aria-label="Filter by action"
          >
            <option value="">ALL ACTIONS</option>
            <option value="SKILL_CREATED">SKILL_CREATED</option>
            <option value="SKILL_UPDATED">SKILL_UPDATED</option>
            <option value="SKILL_PUBLISHED">SKILL_PUBLISHED</option>
            <option value="SKILL_ARCHIVED">SKILL_ARCHIVED</option>
            <option value="SKILL_DELETED">SKILL_DELETED</option>
            <option value="EXECUTION_STARTED">EXECUTION_STARTED</option>
            <option value="EXECUTION_COMPLETED">EXECUTION_COMPLETED</option>
            <option value="EXECUTION_FAILED">EXECUTION_FAILED</option>
            <option value="EXECUTION_CANCELLED">EXECUTION_CANCELLED</option>
            <option value="EXECUTION_REPLAYED">EXECUTION_REPLAYED</option>
            <option value="APPROVAL_REQUESTED">APPROVAL_REQUESTED</option>
            <option value="APPROVAL_APPROVED">APPROVAL_APPROVED</option>
            <option value="APPROVAL_REJECTED">APPROVAL_REJECTED</option>
            <option value="TOOL_EXECUTED">TOOL_EXECUTED</option>
          </select>
        </label>
      </div>

      {/* Log table */}
      {isLoading ? (
        <SkeletonTable cols={4} rows={8} />
      ) : isError ? (
        <EmptyState
          title="Failed to load audit log"
          description="There was an error fetching the audit trail."
          action={
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 cursor-pointer"
            >
              [ RETRY ]
            </button>
          }
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
          title="No audit entries"
          description="Actions like skill creation, publishing, execution, and approvals will appear here."
        />
      ) : (
        <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 overflow-hidden shadow-sm">
          <div className="max-h-[65vh] overflow-y-auto">
            <table className="w-full text-left font-mono">
              <thead className="sticky top-0 bg-slate-100 dark:bg-[#0a0a0a] z-10">
                <tr className="text-[9px] uppercase tracking-widest text-slate-600 dark:text-slate-500 border-b border-slate-200 dark:border-indigo-950/60">
                  <th className="py-2.5 px-4 font-semibold">TIMESTAMP</th>
                  <th className="py-2.5 px-3 font-semibold">ACTION</th>
                  <th className="py-2.5 px-3 font-semibold">EXECUTION</th>
                  <th className="py-2.5 px-4 font-semibold">DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-indigo-950/50">
                {data.map((entry) => (
                  <tr key={entry.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors align-top">
                    <td className="py-2.5 px-4 text-[10px] text-slate-600 dark:text-slate-500 whitespace-nowrap font-medium">
                      {formatDate(entry.timestamp)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider ${actionStyle(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[10px] text-slate-600 dark:text-slate-500 font-mono">{shortId(entry.executionId)}</td>
                    <td className="py-2.5 px-4 text-[10px] text-slate-700 dark:text-slate-400 max-w-md truncate font-mono" title={JSON.stringify(entry.details)}>
                      {Object.keys(entry.details ?? {}).length > 0 ? JSON.stringify(entry.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
