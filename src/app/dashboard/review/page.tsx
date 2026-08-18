"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  CheckSquare,
  X,
  Ban,
  Clock,
  MessageSquare,
  Play,
} from "lucide-react";
import { SkeletonGrid } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";
import { clsx } from "clsx";
import { ApprovalRequestDTO } from "@/types/approval";
import { executionsApi } from "@/lib/api/executions";

const pad = (n: number) => String(n).padStart(2, "0");

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusStyles: Record<string, string> = {
  PENDING: "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold",
  APPROVED: "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold",
  REJECTED: "border-red-400 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 font-semibold",
  EXPIRED: "border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-400 font-medium",
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

function ReviewCard({
  request,
  onApprove,
  onReject,
  onCancel,
  isProcessing,
}: {
  request: ApprovalRequestDTO;
  onApprove: (request: ApprovalRequestDTO) => void;
  onReject: (request: ApprovalRequestDTO, reason: string) => void;
  onCancel: (request: ApprovalRequestDTO) => void;
  isProcessing: boolean;
}) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/80 p-5 space-y-4 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500/40 transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={clsx(
              "px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
              statusStyles[request.status] ?? "border-slate-300 text-slate-600 dark:text-slate-400"
            )}
          >
            {request.status}
          </span>
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" />
            {formatDate(request.requestedAt)}
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-500">
          ID {request.id.slice(0, 10)}…
        </span>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/60 font-semibold">
          Requested Action
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-1 rounded border border-indigo-300 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30 text-xs font-mono font-semibold text-indigo-900 dark:text-indigo-200">
            {request.toolName}
          </span>
          <span className="text-xs font-mono text-slate-400">·</span>
          <span className="text-xs font-mono text-amber-700 dark:text-amber-400 font-bold">
            {request.action}
          </span>
        </div>
      </div>

      {request.skillName && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/60 font-semibold">Skill</div>
          <div className="text-xs font-mono text-slate-800 dark:text-slate-300 font-medium">{request.skillName}</div>
        </div>
      )}

      {request.plannerReason && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/60 font-semibold">Reason from Planner</div>
          <div className="text-[11px] font-mono text-slate-800 dark:text-slate-400 bg-slate-50 dark:bg-black/50 rounded border border-slate-200 dark:border-indigo-900/30 p-3 leading-relaxed">
            &ldquo;{request.plannerReason}&rdquo;
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/60 font-semibold">Arguments</div>
        <pre className="text-[10px] font-mono text-slate-800 dark:text-slate-400 bg-slate-50 dark:bg-black/60 rounded border border-slate-200 dark:border-indigo-900/30 p-3 overflow-x-auto max-h-40">
          {JSON.stringify(request.inputPayload, null, 2)}
        </pre>
      </div>

      {request.status === "PENDING" && (
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-indigo-950/60">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onApprove(request)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-emerald-500/40 bg-emerald-600 dark:bg-emerald-950/40 text-white dark:text-emerald-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-emerald-500 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <Play className="h-3.5 w-3.5" /> APPROVE & RESUME
            </button>
            <button
              type="button"
              onClick={() => setShowRejectInput(!showRejectInput)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-red-100 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <X className="h-3.5 w-3.5" /> REJECT
            </button>
            <button
              type="button"
              onClick={() => onCancel(request)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-400 text-[10px] font-mono uppercase tracking-wider hover:bg-slate-200 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <Ban className="h-3.5 w-3.5" /> CANCEL WORKFLOW
            </button>
          </div>

          {showRejectInput && (
            <div className="space-y-2 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-red-600 dark:text-red-400/80 font-semibold">
                <MessageSquare className="h-3 w-3" />
                Rejection reason (optional):
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why is this action being rejected?"
                className="w-full rounded border border-red-300 dark:border-red-500/30 bg-white dark:bg-black/60 px-3 py-2 text-[11px] font-mono text-slate-900 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-red-400 transition-all resize-none h-16 shadow-sm"
              />
              <button
                type="button"
                onClick={() => {
                  onReject(request, rejectReason);
                  setShowRejectInput(false);
                  setRejectReason("");
                }}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-400 bg-red-600 text-white dark:text-red-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-red-500 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                CONFIRM REJECTION
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"PENDING" | "HISTORY">("PENDING");

  // Single query — GET /api/approvals returns every request for this user
  // (pending + history). The tabs filter client-side; no separate pending
  // route exists on the backend.
  const { data: approvalsData, isLoading } = useQuery<ApprovalRequestDTO[]>({
    queryKey: ["approvals"],
    queryFn: () => apiFetch("/api/approvals"),
  });

  const pendingList = (approvalsData ?? []).filter((r) => r.status === "PENDING");
  const historyList = (approvalsData ?? []).filter((r) => r.status !== "PENDING");

  // Approve = respond approved (single-use idempotency key) THEN resume the
  // paused execution. The engine marks the request APPROVED; the resume route
  // performs duplicate prevention, step-limit enforcement, and re-invokes the
  // graph from the restored state.
  const approveMutation = useMutation({
    mutationFn: async (request: ApprovalRequestDTO) => {
      await apiFetch("/api/approvals", {
        method: "POST",
        body: JSON.stringify({
          approvalId: request.id,
          approved: true,
          idempotencyKey: request.idempotencyKey,
        }),
      });
      await executionsApi.resume(request.executionId, request.id, request.idempotencyKey);
    },
    onSuccess: () => {
      toast.success("Action approved", "Execution is resuming");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["executions"] });
    },
    onError: (e) => toast.error("Approval failed", e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ request, reason }: { request: ApprovalRequestDTO; reason: string }) =>
      apiFetch("/api/approvals", {
        method: "POST",
        body: JSON.stringify({
          approvalId: request.id,
          approved: false,
          rejectionReason: reason || undefined,
          idempotencyKey: request.idempotencyKey,
        }),
      }),
    onSuccess: () => {
      toast.success("Action rejected");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["executions"] });
    },
    onError: (e) => toast.error("Rejection failed", e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (request: ApprovalRequestDTO) =>
      apiFetch(`/api/approvals/${request.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: request.idempotencyKey }),
      }),
    onSuccess: () => {
      toast.success("Workflow cancelled");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["executions"] });
    },
    onError: (e) => toast.error("Cancel failed", e.message),
  });

  const isProcessing =
    approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending;

  return (
    <div className="space-y-6 w-full font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <div>
          <h1 className="text-lg sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide flex items-center gap-2 sm:gap-3">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>HUMAN REVIEW QUEUE</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Human-in-the-Loop authorization: review, approve, or reject paused agent tool calls.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-indigo-950/60 pb-3">
        <button
          type="button"
          onClick={() => setTab("PENDING")}
          className={clsx(
            "inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-all cursor-pointer",
            tab === "PENDING"
              ? "border border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 shadow-sm"
              : "border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          )}
        >
          <CheckSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          [ PENDING ({pad(pendingList.length)}) ]
        </button>
        <button
          type="button"
          onClick={() => setTab("HISTORY")}
          className={clsx(
            "inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-all cursor-pointer",
            tab === "HISTORY"
              ? "border border-indigo-400 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300 shadow-sm"
              : "border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          )}
        >
          <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          [ REVIEW HISTORY ]
        </button>
      </div>

      {/* Tab Content */}
      {tab === "PENDING" && (
        <div>
          {isLoading ? (
            <SkeletonGrid cards={3} />
          ) : pendingList.length === 0 ? (
            <EmptyState
              icon={<Shield className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
              title="Review queue is clear"
              description="No agent actions are awaiting human approval. When a skill hits an action requiring review, it will pause and appear here."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingList.map((req) => (
                <ReviewCard
                  key={req.id}
                  request={req}
                  onApprove={(request) => approveMutation.mutate(request)}
                  onReject={(request, reason) => rejectMutation.mutate({ request, reason })}
                  onCancel={(request) => cancelMutation.mutate(request)}
                  isProcessing={isProcessing}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "HISTORY" && (
        <div>
          {isLoading ? (
            <SkeletonGrid cards={3} />
          ) : historyList.length === 0 ? (
            <EmptyState
              title="No review history"
              description="Past approvals, rejections, and expired review requests will be displayed here."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {historyList.map((req) => (
                <ReviewCard
                  key={req.id}
                  request={req}
                  onApprove={() => {}}
                  onReject={() => {}}
                  onCancel={() => {}}
                  isProcessing={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
