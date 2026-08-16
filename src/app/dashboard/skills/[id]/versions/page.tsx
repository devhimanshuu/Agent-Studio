"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, GitCompare, Rocket, FileText } from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { StatusBadge } from "@/components/skills/StatusBadge";
import { SkeletonVersions } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function SkillVersionsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: skill, isLoading, isError } = useQuery({
    queryKey: ["skill", id],
    queryFn: () => skillsApi.get(id),
  });

  if (isLoading) return <SkeletonVersions />;
  if (isError || !skill) {
    return (
      <EmptyState
        title="Skill not found"
        description="This skill does not exist or you do not have access to it."
        action={
          <Link
            href="/dashboard/skills"
            className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all"
          >
            [ BACK TO REGISTRY ]
          </Link>
        }
      />
    );
  }

  const versions = [...(skill.versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="border-b border-indigo-950/80 pb-5">
        <Link
          href={`/dashboard/skills/${id}`}
          className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors mb-2"
        >
          <ChevronLeft className="h-3 w-3" /> BACK TO SKILL
        </Link>
        <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide flex items-center gap-3">
          <GitCompare className="h-6 w-6 text-indigo-400" />
          VERSION HISTORY
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-mono">{skill.name}</p>
      </div>

      {versions.length === 0 ? (
        <EmptyState
          title="No versions yet"
          description="Save your draft and publish it to start building version history."
        />
      ) : (
        <ol className="space-y-3">
          {versions.map((v) => (
            <li
              key={v.id}
              className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-400 dark:hover:border-indigo-500/40 shadow-xs transition-colors"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">v{v.versionNumber}</span>
                  <StatusBadge status={v.status} />
                  {skill.currentDraftId === v.id && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono font-semibold">
                      CURRENT DRAFT
                    </span>
                  )}
                  {skill.publishedVersionId === v.id && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-semibold flex items-center gap-1">
                      <Rocket className="h-2.5 w-2.5" /> LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                  <span>CREATED {formatDate(v.createdAt)}</span>
                  {v.publishedAt && <span className="text-emerald-700 dark:text-emerald-400 font-medium">PUBLISHED {formatDate(v.publishedAt)}</span>}
                </div>
                {(v.notes || v.changelog) && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono flex items-start gap-1.5">
                    <FileText className="h-3 w-3 text-indigo-500 dark:text-indigo-400/70 mt-0.5 shrink-0" />
                    {v.notes || v.changelog}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/dashboard/skills/${id}/edit`}
                  className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-indigo-500/40 bg-slate-100 dark:bg-indigo-950/40 text-[10px] font-mono text-slate-700 dark:text-indigo-300 hover:border-indigo-400 hover:bg-slate-200 dark:hover:bg-indigo-900/60 hover:text-slate-900 dark:hover:text-white transition-all font-semibold"
                >
                  [ EDIT ]
                </Link>
                {v.status !== "PUBLISHED" && (
                  <Link
                    href={`/dashboard/skills/${id}/edit`}
                    className="px-2.5 py-1.5 rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 hover:border-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:text-emerald-800 dark:hover:text-white transition-all font-semibold"
                  >
                    [ CONTINUE DRAFT ]
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
