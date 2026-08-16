"use client";

import React from "react";
import Link from "next/link";
import { Play, Edit3, Copy, Trash2, GitCompare, Workflow, ShieldAlert } from "lucide-react";
import { SkillDTO } from "@/types/skill";
import { StatusBadge } from "@/components/skills/StatusBadge";
import { WorkflowStepChain } from "./WorkflowStepChain";
import { formatDate } from "@/lib/api/dates";

interface WorkflowCardProps {
  workflow: SkillDTO;
  onDuplicate: (id: string) => void;
  onDelete: (workflow: SkillDTO) => void;
  isDuplicating?: boolean;
}

export function WorkflowCard({
  workflow,
  onDuplicate,
  onDelete,
  isDuplicating = false,
}: WorkflowCardProps) {
  const version = workflow.publishedVersion ?? workflow.currentDraft;
  const allowedTools = version?.allowedTools ?? [];
  const actionsRequiringApproval = version?.actionsRequiringApproval ?? [];
  const hasPublished = !!workflow.publishedVersion;

  return (
    <div className="p-5 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 space-y-4 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col justify-between font-mono shadow-sm">
      {/* Top row: Status & Metadata */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <StatusBadge status={workflow.status} />
            {hasPublished ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 font-bold">
                v{workflow.publishedVersion?.versionNumber} PUBLISHED
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-300 font-bold">
                v{workflow.currentDraft?.versionNumber ?? 1} DRAFT
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {formatDate(workflow.updatedAt)}
          </span>
        </div>

        {/* Title & Purpose */}
        <div>
          <Link
            href={`/dashboard/workflows/${workflow.id}/edit`}
            className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
          >
            {workflow.name}
          </Link>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-serif line-clamp-2 mt-1 leading-relaxed">
            {workflow.purpose}
          </p>
        </div>

        {/* Visual Step Pipeline */}
        <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-indigo-700 dark:text-indigo-400/80 font-bold">
            STEP PIPELINE ({allowedTools.length + 1} steps)
          </div>
          <WorkflowStepChain
            allowedTools={allowedTools}
            actionsRequiringApproval={actionsRequiringApproval}
            compact
          />
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/dashboard/skills/${workflow.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-indigo-400/80 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-sm transition-all text-xs cursor-pointer"
          >
            <Play className="h-3 w-3" />
            [ RUN ]
          </Link>
          <Link
            href={`/dashboard/workflows/${workflow.id}/edit`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-indigo-900/60 bg-slate-50 dark:bg-indigo-950/30 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all text-xs"
          >
            <Edit3 className="h-3 w-3" />
            EDIT
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDuplicate(workflow.id)}
            disabled={isDuplicating}
            title="Duplicate Workflow"
            className="p-1.5 rounded border border-slate-200 dark:border-indigo-900/40 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-400 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(workflow)}
            title="Delete Workflow"
            className="p-1.5 rounded border border-slate-200 dark:border-red-900/40 text-slate-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:border-red-400 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
