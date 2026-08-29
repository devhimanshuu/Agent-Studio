"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Play, X, ArrowUpRight, Clock, MessageSquare } from "lucide-react";
import { ApprovalRequestDTO } from "@/types/approval";
import { executionsApi } from "@/lib/api/executions";
import { toast } from "@/stores/toastStore";

interface EnhancedApprovalQueueProps {
  approvals: ApprovalRequestDTO[];
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function EnhancedApprovalQueue({ approvals }: EnhancedApprovalQueueProps) {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const approveMutation = useMutation({
    mutationFn: async (req: ApprovalRequestDTO) => {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: req.id,
          approved: true,
          idempotencyKey: req.idempotencyKey,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Approval failed");
      await executionsApi.resume(req.executionId, req.id, req.idempotencyKey);
    },
    onSuccess: () => {
      toast.success("Action approved", "Execution resuming");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error("Approval failed", e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ req, reason }: { req: ApprovalRequestDTO; reason: string }) => {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: req.id,
          approved: false,
          rejectionReason: reason || undefined,
          idempotencyKey: req.idempotencyKey,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Rejection failed");
    },
    onSuccess: () => {
      toast.success("Action rejected");
      setRejectingId(null);
      setRejectReason("");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error("Rejection failed", e.message),
  });

  const isBusy = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="p-6 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 h-full shadow-sm font-mono flex flex-col justify-between">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              HUMAN REVIEW QUEUE ({approvals.length})
            </h3>
          </div>
          <Link
            href="/dashboard/review"
            className="text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 font-semibold flex items-center gap-1"
          >
            [ FULL QUEUE ] <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* List of approvals */}
        {approvals.length === 0 ? (
          <div className="py-6 text-center space-y-1.5 border border-dashed border-slate-200 dark:border-indigo-950/60 rounded-md p-4">
            <Shield className="h-6 w-6 text-emerald-500 mx-auto opacity-80" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Review queue is clear</p>
            <p className="text-[11px] text-slate-500 font-sans">
              When an agent requests a write action requiring human approval, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.slice(0, 3).map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-lg border border-amber-300/80 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                      {req.toolName}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {req.action}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                    <Clock className="h-3 w-3" /> {formatDate(req.requestedAt)}
                  </span>
                </div>

                {req.plannerReason && (
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 italic line-clamp-2 bg-white/60 dark:bg-black/40 p-2 rounded border border-amber-200/50 dark:border-amber-950/40">
                    &ldquo;{req.plannerReason}&rdquo;
                  </p>
                )}

                {rejectingId === req.id ? (
                  <div className="space-y-2 pt-1 animate-fadeIn">
                    <div className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-semibold">
                      <MessageSquare className="h-3 w-3" /> Rejection Reason:
                    </div>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Why is this being rejected?"
                      className="w-full text-xs font-mono rounded border border-red-300 dark:border-red-500/40 bg-white dark:bg-black/60 px-2.5 py-1.5 text-slate-900 dark:text-slate-100"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => rejectMutation.mutate({ req, reason: rejectReason })}
                        disabled={isBusy}
                        className="px-2.5 py-1 rounded bg-red-600 text-white text-[10px] font-bold uppercase hover:bg-red-500 transition-all disabled:opacity-50"
                      >
                        CONFIRM REJECT
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        className="text-[10px] text-slate-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 dark:border-amber-950/40">
                    <span className="text-[10px] text-slate-500 font-semibold">
                      Skill: {req.skillName || "Agent Workflow"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => approveMutation.mutate(req)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-400 bg-emerald-600 text-white text-[10px] font-bold uppercase hover:bg-emerald-500 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        <Play className="h-3 w-3" /> APPROVE
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(req.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[10px] font-bold uppercase hover:bg-red-100 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <X className="h-3 w-3" /> REJECT
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60">
        <Link
          href="/dashboard/review"
          className="text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center justify-center gap-1 font-semibold"
        >
          OPEN HUMAN-IN-THE-LOOP CENTER →
        </Link>
      </div>
    </div>
  );
}
