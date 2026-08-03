"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  CheckSquare,
  X,
  Ban,
  Clock,
  Eye,
  MessageSquare,
  AlertTriangle,
  Play,
} from "lucide-react";
import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Reveal } from "@/components/Reveal";
import { toast } from "@/stores/toastStore";
import { clsx } from "clsx";
import { ApprovalRequestDTO } from "@/types/approval";

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
  PENDING: "border-amber-500/40 bg-amber-950/40 text-amber-300",
  APPROVED: "border-emerald-500/40 bg-emerald-950/40 text-emerald-300",
  REJECTED: "border-red-500/40 bg-red-950/40 text-red-300",
  EXPIRED: "border-slate-500/40 bg-slate-950/40 text-slate-400",
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
  onApprove: () => void;
  onReject: (reason: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/80 p-5 space-y-4 hover:border-indigo-500/40 transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={clsx(
              "px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
              statusStyles[request.status] ?? "border-slate-500/40 text-slate-400"
            )}
          >
            {request.status}
          </span>
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(request.requestedAt)}
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-600">
          ID {request.id.slice(0, 10)}…
        </span>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/60">
          Requested Action
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-1 rounded border border-indigo-500/30 bg-indigo-950/30 text-xs font-mono font-semibold text-indigo-200">
            {request.toolName}
          </span>
          <span className="text-xs font-mono text-slate-400">·</span>
          <span className="text-xs font-mono text-amber-400 font-semibold">
            {request.action}
          </span>
        </div>
      </div>

      {request.skillName && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/60">Skill</div>
          <div className="text-xs font-mono text-slate-300">{request.skillName}</div>
        </div>
      )}

      {request.plannerReason && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/60">Reason from Planner</div>
          <div className="text-[11px] font-mono text-slate-400 bg-black/50 rounded border border-indigo-900/30 p-3 leading-relaxed">
            &ldquo;{request.plannerReason}&rdquo;
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/60">Arguments</div>
        <pre className="text-[10px] font-mono text-slate-400 bg-black/60 rounded border border-indigo-900/30 p-3 overflow-x-auto max-h-40">
          {JSON.stringify(request.inputPayload, null, 2)}
        </pre>
      </div>

      {request.status === "PENDING" && (
        <div className="space-y-3 pt-2 border-t border-indigo-950/60">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-emerald-950/60 hover:border-emerald-400 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" /> APPROVE & RESUME
            </button>
            <button
              type="button"
              onClick={() => setShowRejectInput(!showRejectInput)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-red-500/40 bg-red-950/40 text-red-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-red-950/60 hover:border-red-400 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> REJECT
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-500/40 bg-slate-950/40 text-slate-400 text-[10px] font-mono uppercase tracking-wider hover:bg-slate-950/60 hover:border-slate-400 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              <Ban className="h-3.5 w-3.5" /> CANCEL WORKFLOW
            </button>
          </div>

          {showRejectInput && (
            <div className="space-y-2 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-red-400/80">
                <MessageSquare className="h-3 w-3" />
                Rejection reason (optional):
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why is this action being rejected?"
                className="w-full rounded border border-red-500/30 bg-black/60 px-3 py-2 text-[11px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-red-400/60 transition-all resize-none h-16"
              />
              <button
                type="button"
                onClick={() => {
                  onReject(rejectReason);
                  setShowRejectInput(false);
                  setRejectReason("");
                }}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-500/40 bg-red-950/40 text-red-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-red-950/60 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
              >
                <X className="h-3 w-3" /> CONFIRM REJECTION
              </button>
            </div>
          )}
        </div>
      )}

      {request.status === "APPROVED" && (
        <div className="pt-2 border-t border-indigo-950/60">
          <p className="text-[10px] font-mono text-emerald-400/80 flex items-center gap-1.5">
            <CheckSquare className="h-3 w-3" /> Approved on {formatDate(request.respondedAt)}
          </p>
        </div>
      )}
      {request.status === "REJECTED" && (
        <div className="pt-2 border-t border-indigo-950/60 space-y-1">
          <p className="text-[10px] font-mono text-red-400/80 flex items-center gap-1.5">
            <X className="h-3 w-3" /> Rejected on {formatDate(request.respondedAt)}
          </p>
          {request.rejectionReason && (
            <p className="text-[10px] font-mono text-slate-500">Reason: {request.rejectionReason}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReviewQueuePage() {
  const queryClient = useQueryClient();

  const { data: approvals, isLoading, isError, refetch } = useQuery({
    queryKey: ["reviews"],
    queryFn: () => apiFetch<ApprovalRequestDTO[]>("/api/approvals"),
  });

  const { data: history } = useQuery({
    queryKey: ["review-history"],
    queryFn: async () => {
      const res = await fetch("/api/approvals");
      const json = await res.json();
      if (!json.success) return [];
      return json.data as ApprovalRequestDTO[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      approvalId,
      idempotencyKey,
    }: {
      approvalId: string;
      idempotencyKey: string;
    }) => {
      return apiFetch("/api/approvals", {
        method: "POST",
        body: JSON.stringify({ approvalId, approved: true, idempotencyKey }),
      });
    },
    onSuccess: () => {
      toast.success("Action approved — execution will resume");
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["review-history"] });
    },
    onError: (e: Error) => toast.error("Failed to approve", e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      approvalId,
      idempotencyKey,
      reason,
    }: {
      approvalId: string;
      idempotencyKey: string;
      reason: string;
    }) => {
      return apiFetch("/api/approvals", {
        method: "POST",
        body: JSON.stringify({
          approvalId,
          approved: false,
          rejectionReason: reason,
          idempotencyKey,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Action rejected — execution terminated");
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["review-history"] });
    },
    onError: (e: Error) => toast.error("Failed to reject", e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({
      approvalId,
      idempotencyKey,
    }: {
      approvalId: string;
      idempotencyKey: string;
    }) => {
      return apiFetch(`/api/approvals/${approvalId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey }),
      });
    },
    onSuccess: () => {
      toast.success("Workflow cancelled");
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["review-history"] });
    },
    onError: (e: Error) => toast.error("Failed to cancel workflow", e.message),
  });

  const pendingRequests = (approvals ?? []).filter((a) => a.status === "PENDING");
  const historyRequests = (history ?? []).filter((a) => a.status !== "PENDING");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const withProcessing = (id: string, fn: () => void) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    fn();
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleApprove = (request: ApprovalRequestDTO) => {
    setProcessingIds((prev) => new Set(prev).add(request.id));
    approveMutation.mutate(
      { approvalId: request.id, idempotencyKey: request.idempotencyKey },
      {
        onSettled: () => {
          setProcessingIds((prev) => { const n = new Set(prev); n.delete(request.id); return n; });
        },
      }
    );
  };

  const handleReject = (request: ApprovalRequestDTO, reason: string) => {
    setProcessingIds((prev) => new Set(prev).add(request.id));
    rejectMutation.mutate(
      { approvalId: request.id, idempotencyKey: request.idempotencyKey, reason },
      {
        onSettled: () => {
          setProcessingIds((prev) => { const n = new Set(prev); n.delete(request.id); return n; });
        },
      }
    );
  };

  const handleCancel = (request: ApprovalRequestDTO) => {
    setProcessingIds((prev) => new Set(prev).add(request.id));
    cancelMutation.mutate(
      { approvalId: request.id, idempotencyKey: request.idempotencyKey },
      {
        onSettled: () => {
          setProcessingIds((prev) => { const n = new Set(prev); n.delete(request.id); return n; });
        },
      }
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-950/80 pb-6">
        <Reveal delay={0}>
          <div>
            <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide flex items-center gap-3">
              <Shield className="h-6 w-6 text-amber-400" />
              HUMAN REVIEW
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Review, approve, or reject write actions requested by agent skills.
            </p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 px-3 py-2 rounded border border-indigo-900/50 bg-[#0a0a0a]/80">
            <CheckSquare className="h-3.5 w-3.5 text-amber-400" />
            {pad(pendingRequests.length)} PENDING · {pad(historyRequests.length)} HISTORY
          </div>
        </Reveal>
      </div>

      <div className="space-y-4">
        <Reveal delay={0}>
          <h2 className="text-xs font-mono uppercase tracking-widest text-amber-400/80 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> PENDING REVIEWS
          </h2>
        </Reveal>

        {isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : isError ? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Failed to load reviews"
            description="There was an error fetching your review queue. Please try again."
            action={
              <button
                onClick={() => refetch()}
                className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 cursor-pointer"
              >
                [ RETRY ]
              </button>
            }
          />
        ) : pendingRequests.length === 0 ? (
          <Reveal delay={100}>
            <EmptyState
              icon={<CheckSquare className="h-6 w-6 text-emerald-400" />}
              title="No pending reviews"
              description="All write actions have been reviewed. When an agent skill requests a write action, it will appear here."
            />
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingRequests.map((request, index) => (
              <Reveal key={request.id} delay={index * 60}>
                <ReviewCard
                  request={request}
                  onApprove={() => handleApprove(request)}
                  onReject={(reason) => handleReject(request, reason)}
                  onCancel={() => handleCancel(request)}
                  isProcessing={processingIds.has(request.id)}
                />
              </Reveal>
            ))}
          </div>
        )}
      </div>

      {historyRequests.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-indigo-950/80">
          <Reveal delay={0}>
            <h2 className="text-xs font-mono uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Eye className="h-4 w-4" /> REVIEW HISTORY
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {historyRequests.map((request, index) => (
              <Reveal key={request.id} delay={index * 40}>
                <ReviewCard
                  request={request}
                  onApprove={() => {}}
                  onReject={() => {}}
                  onCancel={() => {}}
                  isProcessing={false}
                />
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}