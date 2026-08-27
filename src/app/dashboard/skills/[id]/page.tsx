"use client";

import React, { useState, useEffect } from "react";
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
  Maximize2,
  Network,
} from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { executionsApi } from "@/lib/api/executions";
import { StatusBadge } from "@/components/skills/StatusBadge";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { SkeletonSkillDetail } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";
import { getPrefilledExecutionInput, safeParseExecutionInput } from "@/lib/execution/inputHelper";
import { JsonEditorModal } from "@/components/common/JsonEditorModal";

function JsonPreview({ label, value }: { label: string; value?: Record<string, unknown> | null }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 mb-1.5 font-semibold">{label}</div>
      <pre className="rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-black/60 p-3 text-[10px] text-slate-800 dark:text-slate-400 font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre shadow-sm">
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
  const [runInput, setRunInput] = useState("{\n  \n}");
  const [runInputError, setRunInputError] = useState<string | null>(null);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  const { data: skill, isLoading, isError } = useQuery({
    queryKey: ["skill", id],
    queryFn: () => skillsApi.get(id),
  });

  const draft = skill?.currentDraft ?? null;

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (draft && !initialized) {
      setRunInput(getPrefilledExecutionInput(draft));
      setInitialized(true);
    }
  }, [draft, initialized]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["skill", id] });
    queryClient.invalidateQueries({ queryKey: ["skills"] });
  };

  const publishMutation = useMutation({
    mutationFn: () => skillsApi.publish(id, skill!.currentDraft!.id),
    onSuccess: (v) => {
      toast.success("Version published", `Draft published as v${v.versionNumber}`, {
        action: {
          label: "OPEN IN CANVAS",
          href: `/dashboard/canvas/${id}`,
        },
      });
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
    mutationFn: ({ versionId, inputData }: { versionId: string; inputData: Record<string, unknown> }) =>
      executionsApi.start(versionId, inputData),
    onSuccess: (execution) => {
      toast.success("Execution started", "Running the graph…");
      router.push(`/dashboard/executions/${execution.id}`);
    },
    onError: (e) => toast.error("Execution failed to start", e.message),
  });

  const runDraft = () => {
    if (!draft) return;
    try {
      const inputData = safeParseExecutionInput(runInput);
      setRunInputError(null);
      runMutation.mutate({ versionId: draft.id, inputData });
    } catch (err) {
      setRunInputError(err instanceof Error ? err.message : "Invalid JSON input payload");
    }
  };

  const runConfirm = async () => {
    if (!confirm || !skill) return;
    setIsPending(true);
    try {
      if (confirm === "archive") {
        await skillsApi.archive(skill.id);
        toast.success("Skill archived");
        invalidate();
      } else {
        await skillsApi.delete(skill.id);
        toast.success("Skill deleted");
        router.push("/dashboard/skills");
      }
      setConfirm(null);
    } catch (e) {
      toast.error(confirm === "archive" ? "Archive failed" : "Delete failed", e instanceof Error ? e.message : undefined);
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) return <SkeletonSkillDetail />;
  if (isError || !skill) {
    return (
      <EmptyState
        title="Skill not found"
        description="This skill does not exist or you do not have access to it."
        action={
          <Link
            href="/dashboard/skills"
            className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all cursor-pointer"
          >
            [ BACK TO REGISTRY ]
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-indigo-950/80 pb-5 space-y-3">
        <Link
          href="/dashboard/skills"
          className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 transition-colors font-semibold"
        >
          <ChevronLeft className="h-3 w-3" /> BACK TO REGISTRY
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-pixel text-pixel-glow uppercase tracking-tight">{skill.name}</h1>
              <StatusBadge status={skill.status} />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-mono max-w-2xl">{skill.purpose}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <Link
              href={`/dashboard/canvas/${skill.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-violet-400/80 bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md shadow-violet-500/20 transition-all text-xs"
              title="Open, visualize, and edit this workflow on the visual Agent Canvas"
            >
              <Network className="h-3.5 w-3.5" /> [ OPEN IN CANVAS ]
            </Link>
            <Link
              href={`/dashboard/skills/${skill.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 transition-all font-semibold shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" /> [ EDIT DRAFT ]
            </Link>
            <Link
              href={`/dashboard/skills/${skill.id}/versions`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 hover:border-indigo-400 transition-all font-semibold shadow-sm"
            >
              <GitCompare className="h-3.5 w-3.5" /> [ VERSIONS ]
            </Link>
            {draft && skill.status !== "ARCHIVED" && (
              <button
                type="button"
                onClick={runDraft}
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
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-indigo-900/40 text-[10px] font-mono text-slate-700 dark:text-slate-400 hover:text-indigo-700 hover:border-indigo-400 transition-all cursor-pointer font-medium disabled:opacity-50"
          >
            <Copy className="h-3 w-3" /> DUPLICATE
          </button>
          {skill.status !== "ARCHIVED" && (
            <button
              type="button"
              onClick={() => setConfirm("archive")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-indigo-900/40 text-[10px] font-mono text-slate-700 dark:text-slate-400 hover:text-amber-700 hover:border-amber-400 transition-all cursor-pointer font-medium"
            >
              <Archive className="h-3 w-3" /> ARCHIVE
            </button>
          )}
          {skill.status !== "PUBLISHED" && (
            <button
              type="button"
              onClick={() => setConfirm("delete")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-indigo-900/40 text-[10px] font-mono text-slate-700 dark:text-slate-400 hover:text-red-700 hover:border-red-400 transition-all cursor-pointer font-medium"
            >
              <Trash2 className="h-3 w-3" /> DELETE
            </button>
          )}
        </div>
      </div>

      {/* Published Active Banner */}
      {skill.publishedVersion && (
        <div className="rounded border border-emerald-300 dark:border-emerald-500/40 bg-gradient-to-r from-emerald-50/90 via-slate-50/70 to-indigo-50/60 dark:from-emerald-950/30 dark:via-[#0a0a0a]/80 dark:to-indigo-950/20 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                PUBLISHED v{skill.publishedVersion.versionNumber} IS ACTIVE
              </span>
              {skill.publishedVersion.graphDefinition && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold border border-violet-200 dark:border-violet-500/40 inline-flex items-center gap-1 font-mono">
                  <Network className="h-3 w-3" /> {skill.publishedVersion.graphDefinition.nodes.length} NODES
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              Ready for production execution and external MCP consumption. Visualize or expand its graph architecture anytime.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-xs w-full sm:w-auto">
            <Link
              href={`/dashboard/canvas/${skill.id}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-violet-400 bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-sm transition-all text-xs w-full sm:w-auto"
            >
              <Network className="h-3.5 w-3.5" /> OPEN IN CANVAS
            </Link>
          </div>
        </div>
      )}

      {/* Execution input editor */}
      {draft && skill.status !== "ARCHIVED" && (
        <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 font-semibold">
              <Play className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Execution Input (JSON)
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsJsonModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-[10px] font-mono text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all cursor-pointer font-semibold shadow-xs"
                title="Expand fullscreen JSON editor"
              >
                <Maximize2 className="h-3 w-3" /> Expand JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  setRunInput(getPrefilledExecutionInput(draft));
                  if (runInputError) setRunInputError(null);
                  toast.info("Input reloaded from schema sample");
                }}
                className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                ↻ Load Sample Input
              </button>
              <span className="text-[10px] font-mono text-slate-500">Sent as user input to the skill</span>
            </div>
          </div>
          <textarea
            value={runInput}
            onChange={(e) => {
              setRunInput(e.target.value);
              if (runInputError) setRunInputError(null);
            }}
            rows={4}
            spellCheck={false}
            placeholder="{ }"
            className={`w-full rounded border bg-white dark:bg-black/60 px-3 py-2 text-[11px] font-mono text-slate-900 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none transition-colors resize-y shadow-sm ${runInputError ? "border-red-500" : "border-slate-300 dark:border-indigo-900/50 focus:border-indigo-500"
              }`}
          />
          {runInputError && <p className="text-[10px] font-mono text-red-600 dark:text-red-400 font-semibold">[ JSON ERROR ] {runInputError}</p>}
        </div>
      )}

      {/* Draft details */}
      {draft ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-5 space-y-4 shadow-sm">
            <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 border-b border-slate-200 dark:border-indigo-950/60 pb-2 font-semibold">
              DRAFT v{draft.versionNumber} · {draft.status}
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-semibold">Instructions</div>
              <p className="text-xs text-slate-800 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                {draft.instructions || "No instructions provided."}
              </p>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400 flex-wrap font-medium">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-300 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300">
                <Wrench className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> {draft.allowedTools.join(", ") || "none"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
                <CheckSquare className="h-3 w-3 text-amber-600 dark:text-amber-400" /> {draft.actionsRequiringApproval.join(", ") || "none"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-300 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300">
                <Code2 className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> max {draft.maxExecutionSteps} steps
              </span>
            </div>

            {draft.notes && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1 font-semibold">
                  <StickyNote className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> Notes
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">{draft.notes}</p>
              </div>
            )}

            {draft.examples.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-semibold">
                  Examples ({draft.examples.length})
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-500 font-mono">
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
              className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all cursor-pointer"
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

      <JsonEditorModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        value={runInput}
        onApply={(updated) => {
          setRunInput(updated);
          if (runInputError) setRunInputError(null);
        }}
        onResetSample={() => {
          const sample = getPrefilledExecutionInput(draft);
          setRunInput(sample);
        }}
      />
    </div>
  );
}
