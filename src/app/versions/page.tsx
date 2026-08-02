import React from "react";
import { GitCompare } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";

export default function VersionsPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto font-mono">
      <div className="border-b border-indigo-950/80 pb-6">
        <div className="text-xs text-indigo-400/70 uppercase tracking-widest mb-1">
          FIG_004 · VERSION COMPARISON · DIFF ENGINE
        </div>
        <h2 className="text-2xl sm:text-3xl font-pixel text-pixel-glow uppercase tracking-tight flex items-center gap-3">
          <GitCompare className="h-6 w-6 text-indigo-400" />
          VERSION COMPARISON & DIFFS
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Compare draft and published skill versions, view diffs, and rerun previous versions.
        </p>
      </div>

      <EmptyState
        title="No version comparisons available"
        description="Select a skill to inspect version history, compare changes side-by-side, or rerun historical versions."
      />
    </div>
  );
}
