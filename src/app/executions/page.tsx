import React from "react";
import { Play } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Reveal } from "@/components/Reveal";

export default function ExecutionsPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto font-mono">
      <Reveal delay={0}>
        <div className="border-b border-indigo-950/80 pb-6">
          <h2 className="text-2xl sm:text-3xl font-pixel text-pixel-glow uppercase tracking-tight flex items-center gap-3">
            <Play className="h-6 w-6 text-emerald-400" />
            EXECUTION HISTORY & TRACES
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor step-by-step agent runs, tool parameters, outputs, and audit logs.
          </p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <EmptyState
          title="No execution traces recorded"
          description="Run a skill test or trigger an execution to see step-by-step agent logs and tool call traces."
        />
      </Reveal>
    </div>
  );
}
