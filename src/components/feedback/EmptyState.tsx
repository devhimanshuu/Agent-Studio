import React, { ReactNode } from "react";
import { Terminal } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center rounded border border-dashed border-indigo-300 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 font-mono space-y-4">
      <div className="p-3 rounded border border-indigo-200 dark:border-indigo-900/40 bg-indigo-100/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
        {icon || <Terminal className="h-6 w-6" />}
      </div>
      <div className="space-y-1.5 max-w-md">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{title}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
