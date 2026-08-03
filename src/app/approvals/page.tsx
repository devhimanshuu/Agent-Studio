import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { CheckSquare, Wrench, ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Reveal } from "@/components/Reveal";
import { ApprovalRepository } from "@/repositories/ApprovalRepository";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function ApprovalsPage() {
  const { userId } = await auth();
  const approvalRepo = new ApprovalRepository();
  const pending = userId ? await approvalRepo.findPendingByUserId(userId) : [];

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

      {pending.length === 0 ? (
        <Reveal delay={100}>
          <EmptyState
            title="No pending write approval requests"
            description="When an agent skill executes a write action (e.g. creating tasks or modifying records), review requests will appear here."
          />
        </Reveal>
      ) : (
        <Reveal delay={100}>
          <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-3 p-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 border-b border-indigo-950/60 pb-2">
              PENDING QUEUE · {pending.length} REQUEST{pending.length === 1 ? "" : "S"}
            </div>
            <ul className="divide-y divide-indigo-950/60">
              {pending.map((a) => (
                <li key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
                      <Wrench className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="font-semibold">{a.toolName}</span>
                      <span className="text-slate-500">· {a.action}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      REQUESTED {formatDate(a.requestedAt)} · id {a.id.slice(0, 10)}…
                    </div>
                    <pre className="text-[10px] text-slate-500 font-mono overflow-x-auto max-w-xl">
                      {JSON.stringify(a.inputPayload)}
                    </pre>
                  </div>
                  <Link
                    href={`/dashboard/executions/${a.executionId}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-amber-500/40 bg-amber-950/40 text-[10px] font-mono text-amber-300 hover:border-amber-400 hover:text-white transition-all shrink-0"
                  >
                    VIEW EXECUTION <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-slate-600 pt-1">
              Approve/reject controls ship with the HITL workflow in the next phase — this queue is read-only for now.
            </p>
          </div>
        </Reveal>
      )}
    </div>
  );
}
