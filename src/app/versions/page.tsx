import React from "react";
import { GitCompare } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Reveal } from "@/components/Reveal";

export default function VersionsPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto font-mono">
      <Reveal delay={0}>
        <div className="border-b border-indigo-950/80 pb-6">
          <h2 className="text-2xl sm:text-3xl font-pixel text-pixel-glow uppercase tracking-tight flex items-center gap-3">
            <GitCompare className="h-6 w-6 text-indigo-400" />
            VERSION COMPARISON & DIFFS
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Compare draft and published skill versions, view diffs, and rerun previous versions.
          </p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <EmptyState
          title="No version comparisons available"
          description="Select a skill to inspect version history, compare changes side-by-side, or rerun historical versions."
        />
      </Reveal>
    </div>
  );
}
