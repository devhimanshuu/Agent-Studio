"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Pencil,
  Rocket,
  Copy,
  Archive,
  Trash2,
  GitCompare,
  Wrench,
  CheckSquare,
  Loader2,
  Code2,
  StickyNote,
  Play,
} from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { executionsApi } from "@/lib/api/executions";
import { StatusBadge } from "@/components/skills/StatusBadge";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";

function JsonPreview({ label, value }: { label: string; value?: Record<string, unknown> | null }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80 mb-1.5">{label}</div>
      <pre className="rounded border border-indigo-900/40 bg-black/60 p-3 text-[10px] text-slate-400 font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </div>
  );
}

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [isPending, setIsPending] = useState(false);

  const { data: skill, isLoading, isError, refetch } = useQuery({
    queryKey: ["skill", id],
    queryFn: () => skillsApi.get(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["skill", id] });
    queryClient.invalidateQueries({ queryKey: ["skills"] });
  };

  const publishMutation = useMutation({
    mutationFn: () => skillsApi.publish(id, skill!.currentDraft!.id),
    onSuccess: (v) => {
      toast.success("Version published", `Draft published as v${v.versionNumber}`);
      invalidate();
    },
    onError: (e) => toast.error("Publish failed", e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => skillsApi.duplicate(id),
    onSuccess: (d) => {
      toast.success("Skill duplicated", `Created "${d.name}"`);
      invalidate();
    },
    onError: (e) => toast.error("Duplicate failed", e.message),
  });

  const runMutation = useMutation({
    mutationFn: (versionId: string) => executionsApi.start(versionId, {}),
    onSuccess: (execution) => {
      toast.success("Execution started", "Running the graph…");
      router.push(`/dashboard/executions/${execution.id}`);
    },
    onError: (e) => toast.error("Execution failed to start", e.message),
  });

  const runConfirm = async () => {
    if (!confirm || !skill) return;
    setIsPending(true);
    try {
      if (confirm === "archive") {
        await skillsApi.archive(id);
        toast.success("Skill archived");
      } else {
        await skillsApi.delete(id);
        toast.success("Skill deleted");
        router.push("/dashboard/skills");
        return;
      }
      setConfirm(null);
      invalidate();
    } catch (e) {
      toast.error(confirm === "archive" ? "Archive failed" : "Delete failed", e instanceof Error ? e.message : undefined);
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (isError || !skill) {
    return (
      <EmptyState
        title="Skill not found"
        description="This skill does not exist or you do not have access to it."
        action={
          <Link
            href="/dashboard/skills"
            className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all"
          >
            [ BACK TO REGISTRY ]
          </Link>
        }
      />
    );
  }

  const draft = skill.currentDraft;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-indigo-950/80 pb-5 space-y-3">
        <Link
          href="/dashboard/skills"
          className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <ChevronLeft className="h-3 w-3" /> BACK TO REGISTRY
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-pixel text-pixel-glow uppercase tracking-tight">{skill.name}</h1>
              <StatusBadge status={skill.status} />
            </div>
            <p className="text-sm text-slate-400 font-mono max-w-2xl">{skill.purpose}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <Link
              href={`/dashboard/skills/${skill.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-indigo-500/40 bg-indigo-950/40 text-indigo-200 hover:border-indigo-400 hover:text-white transition-all"
            >
              <Pencil className="h-3.5 w-3.5" /> [ EDIT DRAFT ]
            </Link>
            <Link
              href={`/dashboard/skills/${skill.id}/versions`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-indigo-500/40 bg-indigo-950/40 text-indigo-200 hover:border-indigo-400 hover:text-white transition-all"
            >
              <GitCompare className="h-3.5 w-3.5" /> [ VERSIONS ]
            </Link>
            {draft && skill.status !== "ARCHIVED" && (
              <button
                type="button"
                onClick={() => runMutation.mutate(draft.id)}
                disabled={runMutation.isPending}
                title="Execute the current draft through the agent runtime"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {runMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                [ RUN DRAFT v{draft.versionNumber} ]
              </button>
            )}
            {draft && skill.status !== "ARCHIVED" && (
              <button
                type="button"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-emerald-400 bg-emerald-600 text-white font-semibold hover:bg-emerald-500 shadow-md shadow-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {publishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                [ PUBLISH v{draft.versionNumber} ]
              </button>
            )}
          </div>
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => duplicateMutation.mutate()}
            disabled={duplicateMutation.isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-indigo-900/40 text-[10px] font-mono text-slate-400 hover:text-indigo-300 hover:border-indigo-500/40 transition-all cursor-pointer disabled:opacity-50"
          >
            <Copy className="h-3 w-3" /> DUPLICATE
          </button>
          {skill.status !== "ARCHIVED" && (
            <button
              type="button"
              onClick={() => setConfirm("archive")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-indigo-900/40 text-[10px] font-mono text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition-all cursor-pointer"
            >
              <Archive className="h-3 w-3" /> ARCHIVE
            </button>
          )}
          {skill.status !== "PUBLISHED" && (
            <button
              type="button"
              onClick={() => setConfirm("delete")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-indigo-900/40 text-[10px] font-mono text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
            >
              <Trash2 className="h-3 w-3" /> DELETE
            </button>
          )}
        </div>
      </div>

      {/* Draft details */}
      {draft ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-5 space-y-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80 border-b border-indigo-950/60 pb-2">
              DRAFT v{draft.versionNumber} · {draft.status}
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80">Instructions</div>
              <p className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                {draft.instructions || "No instructions provided."}
              </p>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-900/50 bg-indigo-950/30">
                <Wrench className="h-3 w-3 text-indigo-400" /> {draft.allowedTools.join(", ") || "none"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-900/50 bg-amber-950/30">
                <CheckSquare className="h-3 w-3 text-amber-400" /> {draft.actionsRequiringApproval.join(", ") || "none"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-900/50 bg-indigo-950/30">
                <Code2 className="h-3 w-3 text-indigo-400" /> max {draft.maxExecutionSteps} steps
              </span>
            </div>

            {draft.notes && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80 flex items-center gap-1">
                  <StickyNote className="h-3 w-3" /> Notes
                </div>
                <p className="text-xs text-slate-400 font-mono">{draft.notes}</p>
              </div>
            )}

            {draft.examples.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/80">
                  Examples ({draft.examples.length})
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  {draft.examples.map((ex, i) => ex.description || `Example ${i + 1}`).join(" • ")}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <JsonPreview label="Input Schema" value={draft.inputSchema} />
            <JsonPreview label="Output Schema" value={draft.outputSchema} />
          </div>
        </div>
      ) : (
        <EmptyState
          title="No draft version"
          description="This skill has no editable draft. Use the editor to create a new draft version."
          action={
            <Link
              href={`/dashboard/skills/${skill.id}/edit`}
              className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all"
            >
              [ CREATE DRAFT ]
            </Link>
          }
        />
      )}

      <ConfirmDialog
        isOpen={confirm !== null}
        title={confirm === "archive" ? "ARCHIVE SKILL" : "DELETE SKILL"}
        description={
          confirm === "archive"
            ? `Archive "${skill.name}"? It will be hidden from active lists but preserved.`
            : `Delete "${skill.name}"? This permanently removes the skill and cannot be undone.`
        }
        confirmLabel={confirm === "archive" ? "ARCHIVE" : "DELETE"}
        variant={confirm === "archive" ? "warning" : "danger"}
        isPending={isPending}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
