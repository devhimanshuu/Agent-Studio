"use client";

import React, { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Sparkles, CheckCircle2, Loader2, Workflow } from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { WorkflowForm } from "@/components/workflows/WorkflowForm";
import { StatusBadge } from "@/components/skills/StatusBadge";
import { toast } from "@/stores/toastStore";

export default function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: workflow, isLoading, isError, error } = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => skillsApi.get(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: Parameters<React.ComponentProps<typeof WorkflowForm>["onSubmit"]>[0]) =>
      skillsApi.update(id, values),
    onSuccess: () => {
      toast.success("Workflow updated", `Draft saved for "${workflow?.name ?? "workflow"}".`);
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to update workflow";
      toast.error("Update failed", msg);
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => {
      const draftId = workflow?.currentDraft?.id;
      if (!draftId) throw new Error("No draft version found to publish");
      return skillsApi.publish(id, draftId);
    },
    onSuccess: (updated) => {
      toast.success("Workflow published", `Version v${updated.versionNumber} is now live.`);
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to publish workflow";
      toast.error("Publish failed", msg);
    },
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center font-mono text-xs text-slate-500 space-y-3">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-indigo-500" />
        <p>[ LOADING WORKFLOW DRAFT... ]</p>
      </div>
    );
  }

  if (isError || !workflow) {
    return (
      <div className="p-8 rounded border border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 font-mono text-xs text-red-700 dark:text-red-300 space-y-3">
        <p>[ ERROR: Workflow not found or access denied ]</p>
        <Link href="/dashboard/workflows" className="underline font-bold">
          ← Back to Workflows Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/workflows"
            className="p-2 rounded border border-slate-200 dark:border-indigo-900/50 hover:border-indigo-400 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
                {workflow.name}
              </h1>
              <StatusBadge status={workflow.status} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Editing Draft v{workflow.currentDraft?.versionNumber ?? 1}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            href={`/dashboard/skills/${workflow.id}`}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded border border-indigo-400/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-xs"
          >
            <Play className="h-3.5 w-3.5" />
            [ RUN WORKFLOW ]
          </Link>

          <button
            type="button"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded border border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-500 font-bold shadow-md shadow-emerald-500/20 text-xs cursor-pointer disabled:opacity-50"
          >
            {publishMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            [ PUBLISH VERSION ]
          </button>
        </div>
      </div>

      <WorkflowForm
        mode="edit"
        workflow={workflow}
        initialDraft={workflow.currentDraft}
        onSubmit={async (values) => {
          await updateMutation.mutateAsync(values);
        }}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  );
}
