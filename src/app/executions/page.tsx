import React from "react";
import { Play } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";

export default function ExecutionsPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto font-mono">
      <div className="border-b border-indigo-950/80 pb-6">
        <div className="text-xs text-indigo-400/70 uppercase tracking-widest mb-1">
          FIG_003 · AUDIT LOGS · RUNTIME TRACING
        </div>
        <h2 className="text-2xl sm:text-3xl font-pixel text-pixel-glow uppercase tracking-tight flex items-center gap-3">
          <Play className="h-6 w-6 text-emerald-400" />
          EXECUTION HISTORY & TRACES
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Monitor step-by-step agent runs, tool parameters, outputs, and audit logs.
        </p>
      </div>

      <EmptyState
        title="No execution traces recorded"
        description="Run a skill test or trigger an execution to see step-by-step agent logs and tool call traces."
      />
    </div>
  );
}
