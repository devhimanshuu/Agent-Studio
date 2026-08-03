"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitCompare, GitBranch, ArrowRight, Plus, Minus, Pencil, Check } from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { compareApi } from "@/lib/api/compare";
import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { clsx } from "clsx";
import { VersionDiffResult } from "@/types/observability";

const kindStyles: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  added: {
    label: "ADDED",
    className: "border-emerald-500/40 bg-emerald-950/30 text-emerald-300",
    icon: <Plus className="h-3 w-3" />,
  },
  removed: {
    label: "REMOVED",
    className: "border-red-500/40 bg-red-950/30 text-red-300",
    icon: <Minus className="h-3 w-3" />,
  },
  modified: {
    label: "MODIFIED",
    className: "border-amber-500/40 bg-amber-950/30 text-amber-300",
    icon: <Pencil className="h-3 w-3" />,
  },
};

function renderValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default function ComparePage() {
  const [skillId, setSkillId] = useState("");
  const [versionA, setVersionA] = useState("");
  const [versionB, setVersionB] = useState("");

  const { data: skills, isLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: () => skillsApi.list({}),
  });

  const versions = useMemo(() => {
    const skill = skills?.items.find((s) => s.id === skillId);
    return skill?.versions ?? [];
  }, [skills, skillId]);

  const { data: diff, isLoading: diffLoading, isError, refetch } = useQuery({
    queryKey: ["compare", versionA, versionB],
    queryFn: () => compareApi.compare(versionA, versionB),
    enabled: Boolean(versionA && versionB && versionA !== versionB),
  });

  const handleSkillChange = (id: string) => {
    setSkillId(id);
    setVersionA("");
    setVersionB("");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-indigo-950/80 pb-5">
        <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide flex items-center gap-3">
          <GitCompare className="h-6 w-6 text-indigo-400" />
          VERSION COMPARISON
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Compare any two versions of the same skill — instructions, schemas, tools, and approval actions.
        </p>
      </div>

      {/* Picker */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-indigo-400/70">Skill</span>
          <select
            value={skillId}
            onChange={(e) => handleSkillChange(e.target.value)}
            className="w-full rounded border border-indigo-900/50 bg-black/50 px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/70 cursor-pointer"
          >
            <option value="">SELECT SKILL…</option>
            {(skills?.items ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-indigo-400/70">Version A (base)</span>
          <select
            value={versionA}
            onChange={(e) => setVersionA(e.target.value)}
            disabled={!skillId || versions.length === 0}
            className="w-full rounded border border-indigo-900/50 bg-black/50 px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/70 cursor-pointer disabled:opacity-40"
          >
            <option value="">SELECT VERSION…</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id} disabled={v.id === versionB}>
                v{v.versionNumber} · {v.status}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-indigo-400/70">Version B (compare)</span>
          <select
            value={versionB}
            onChange={(e) => setVersionB(e.target.value)}
            disabled={!skillId || versions.length === 0}
            className="w-full rounded border border-indigo-900/50 bg-black/50 px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/70 cursor-pointer disabled:opacity-40"
          >
            <option value="">SELECT VERSION…</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id} disabled={v.id === versionA}>
                v{v.versionNumber} · {v.status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !skills || skills.items.length === 0 ? (
        <EmptyState
          icon={<GitCompare className="h-6 w-6" />}
          title="No skills to compare"
          description="Create a skill with at least two versions to see diffs here."
        />
      ) : !versionA || !versionB ? (
        <EmptyState
          icon={<GitCompare className="h-6 w-6" />}
          title="Select two versions"
          description="Pick a skill, then choose Version A and Version B to generate a diff."
        />
      ) : diffLoading ? (
        <LoadingSkeleton rows={5} />
      ) : isError ? (
        <EmptyState
          title="Comparison failed"
          description="Could not compare these versions."
          action={
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 cursor-pointer"
            >
              [ RETRY ]
            </button>
          }
        />
      ) : diff ? (
        <DiffView diff={diff} />
      ) : null}
    </div>
  );
}

function DiffView({ diff }: { diff: VersionDiffResult }) {
  return (
    <div className="space-y-5 font-mono">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-4">
        <span className="text-xs font-semibold text-slate-200">{diff.skillName}</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-indigo-500/40 bg-indigo-950/40 text-[10px] text-indigo-300">
          <GitBranch className="h-3 w-3" /> v{diff.versionA.versionNumber} <ArrowRight className="h-3 w-3" /> v{diff.versionB.versionNumber}
        </span>
        {diff.identical ? (
          <span className="px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-950/40 text-[10px] text-emerald-300">
            IDENTICAL
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded border border-amber-500/40 bg-amber-950/40 text-[10px] text-amber-300">
            {diff.changes.length} CHANGE{diff.changes.length === 1 ? "" : "S"}
          </span>
        )}
      </div>

      {diff.identical ? (
        <EmptyState
          icon={<Check className="h-6 w-6" />}
          title="Versions are identical"
          description="No differences found between these two versions."
        />
      ) : (
        <div className="space-y-3">
          {diff.changes.map((change, idx) => {
            const kind = kindStyles[change.kind] ?? kindStyles.modified;
            return (
              <div key={`${change.field}-${idx}`} className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">{change.field}</span>
                  <span className={clsx("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wider", kind.className)}>
                    {kind.icon} {kind.label}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase tracking-widest text-slate-500">
                      v{diff.versionA.versionNumber} (base)
                    </div>
                    <pre
                      className={clsx(
                        "rounded border bg-black/50 p-3 text-[10px] whitespace-pre-wrap break-words max-h-48 overflow-y-auto",
                        change.kind === "added"
                          ? "border-emerald-900/40 text-slate-600 line-through"
                          : "border-indigo-950/50 text-slate-400"
                      )}
                    >
                      {change.kind === "added" ? "—" : renderValue(change.oldValue)}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase tracking-widest text-slate-500">
                      v{diff.versionB.versionNumber} (compare)
                    </div>
                    <pre
                      className={clsx(
                        "rounded border bg-black/50 p-3 text-[10px] whitespace-pre-wrap break-words max-h-48 overflow-y-auto",
                        change.kind === "removed"
                          ? "border-red-900/40 text-slate-600 line-through"
                          : "border-indigo-950/50 text-slate-300"
                      )}
                    >
                      {change.kind === "removed" ? "—" : renderValue(change.newValue)}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
