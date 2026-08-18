import React from "react";
import { SkillStatus } from "@/types/skill";
import { clsx } from "clsx";

const styles: Record<SkillStatus, string> = {
  DRAFT: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
  PUBLISHED: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  ARCHIVED: "border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-400",
};

export function StatusBadge({ status }: { status: SkillStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider font-semibold shadow-xs",
        styles[status]
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      </span>
      {status}
    </span>
  );
}
