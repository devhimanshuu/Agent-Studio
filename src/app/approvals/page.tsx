import React from "react";
import { CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Reveal } from "@/components/Reveal";

export default function ApprovalsPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto font-mono">
      <Reveal delay={0}>
        <div className="border-b border-indigo-950/80 pb-6">
          <h2 className="text-2xl sm:text-3xl font-pixel text-pixel-glow uppercase tracking-tight flex items-center gap-3">
            <CheckSquare className="h-6 w-6 text-amber-400" />
            HUMAN-IN-THE-LOOP APPROVALS
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review, approve, or reject pending write actions with single-use idempotency protection.
          </p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <EmptyState
          title="No pending write approval requests"
          description="When an agent skill executes a write action (e.g. creating tasks or modifying records), review requests will appear here."
        />
      </Reveal>
    </div>
  );
}
