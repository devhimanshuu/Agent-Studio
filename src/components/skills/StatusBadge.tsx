import React from "react";
import { SkillStatus } from "@/types/skill";
import { clsx } from "clsx";

const styles: Record<SkillStatus, string> = {
  DRAFT: "border-indigo-500/40 bg-indigo-950/40 text-indigo-300",
  PUBLISHED: "border-emerald-500/40 bg-emerald-950/40 text-emerald-300",
  ARCHIVED: "border-slate-500/40 bg-slate-950/40 text-slate-400",
};

export function StatusBadge({ status }: { status: SkillStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
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
