"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Play,
  Loader2,
  ExternalLink,
  Pencil,
  RefreshCw,
  Network,
  CheckCircle2,
} from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { executionsApi } from "@/lib/api/executions";
import { AgentGraphCanvas } from "@/components/canvas/AgentGraphCanvas";
import { StatusBadge } from "@/components/skills/StatusBadge";
import { SkeletonSkillDetail } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";
import { AgentGraphDefinition } from "@/types/graph";
import { clsx } from "clsx";

export default function CanvasEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: skill, isLoading, isError } = useQuery({
    queryKey: ["skill", id],
    queryFn: () => skillsApi.get(id),
  });

  const draft = skill?.currentDraft ?? skill?.publishedVersion ?? null;

  const [graph, setGraph] = useState<AgentGraphDefinition | null>(null);
  const [runInput, setRunInput] = useState("{\n  \n}");
  const [runInputError, setRunInputError] = useState<string | null>(null);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);

  // Initialize graph state from the draft once it loads.
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (draft && !initialized) {
      setGraph(draft.graphDefinition ?? null);
      setInitialized(true);
    }
  }, [draft, initialized]);

  const hasGraph = graph !== null && graph.nodes.length > 0;

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!graph) throw new Error("Nothing to save");
      return skillsApi.update(id, { graphDefinition: graph, instructions: "Visual multi-agent graph." });
    },
    onSuccess: () => {
      toast.success("Graph saved", "Draft updated on the canvas.");
      queryClient.invalidateQueries({ queryKey: ["skill", id] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
    onError: (e) => toast.error("Save failed", e instanceof Error ? e.message : undefined),
  });

  const runMutation = useMutation({
    mutationFn: ({ versionId, inputData }: { versionId: string; inputData: Record<string, unknown> }) =>
      executionsApi.start(versionId, inputData),
    onSuccess: (execution) => {
      toast.success("Execution started", "Tracing the graph live…");
      setActiveExecutionId(execution.id);
      queryClient.invalidateQueries({ queryKey: ["executions"] });
    },
    onError: (e) => toast.error("Execution failed to start", e.message),
  });

  const handleRun = () => {
    if (!draft) return;
    if (!hasGraph) {
      toast.error("Empty graph", "Add at least a START and END node before running.");
      return;
    }
    let inputData: Record<string, unknown>;
    try {
      const trimmed = runInput.trim();
      inputData = trimmed ? JSON.parse(trimmed) : {};
      if (Array.isArray(inputData) || inputData === null || typeof inputData !== "object") {
        throw new Error("Must be a JSON object");
      }
    } catch (err) {
      setRunInputError(err instanceof Error ? err.message : "Invalid JSON input payload");
      return;
    }
    setRunInputError(null);
    // Persist the graph first so the executed version matches the canvas.
    saveMutation.mutateAsync().then(() => {
      runMutation.mutate({ versionId: draft.id, inputData });
    }).catch(() => {
      // Save failure already toasted.
    });
  };

  const running = runMutation.isPending || Boolean(activeExecutionId);

  if (isLoading) return <SkeletonSkillDetail />;
  if (isError || !skill || !draft) {
    return (
      <EmptyState
        title="Agent graph not found"
        description="This graph does not exist or you do not have access to it."
        action={
          <Link
            href="/dashboard/canvas"
            className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all cursor-pointer"
          >
            [ BACK TO CANVAS ]
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-indigo-950/80 pb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/canvas"
            className="p-2 rounded border border-slate-200 dark:border-indigo-900/50 hover:border-indigo-400 text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
            title="Back to canvas gallery"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-pixel text-pixel-glow uppercase tracking-wide truncate">
                {skill.name}
              </h1>
              <StatusBadge status={skill.status} />
              {hasGraph && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold border border-violet-200 dark:border-violet-500/40 inline-flex items-center gap-1">
                  <Network className="h-3 w-3" /> GRAPH
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 truncate font-mono">
              draft v{draft.versionNumber} · {graph?.nodes.length ?? 0} nodes · {graph?.edges.length ?? 0} edges
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono w-full lg:w-auto">
          <Link
            href={`/dashboard/skills/${skill.id}/edit`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-indigo-950/30 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-700 transition-all font-semibold"
            title="Open the classic form editor for this skill"
          >
            <Pencil className="h-3.5 w-3.5" /> [ FORM EDITOR ]
          </Link>

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasGraph || Boolean(activeExecutionId)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-cyan-400 bg-cyan-600 text-white font-semibold hover:bg-cyan-500 transition-all cursor-pointer disabled:opacity-40 shadow-sm"
          >
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            [ SAVE GRAPH ]
          </button>

          <button
            type="button"
            onClick={handleRun}
            disabled={runMutation.isPending || !hasGraph || Boolean(activeExecutionId)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all cursor-pointer disabled:opacity-40"
          >
            {runMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            [ RUN GRAPH ]
          </button>

          {activeExecutionId && (
            <Link
              href={`/dashboard/executions/${activeExecutionId}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-emerald-400 bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-all shadow-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" /> [ FULL TRACE ]
            </Link>
          )}
        </div>
      </div>

      {/* Input editor (collapsed when tracing) */}
      {!activeExecutionId && (
        <div className="shrink-0 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 flex items-center gap-1.5 font-semibold">
              <Play className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Execution Input (JSON)
            </div>
            <span className="text-[9px] font-mono text-slate-500">Sent as user input to the graph</span>
          </div>
          <textarea
            value={runInput}
            onChange={(e) => {
              setRunInput(e.target.value);
              if (runInputError) setRunInputError(null);
            }}
            rows={2}
            spellCheck={false}
            placeholder="{ }"
            className={`w-full rounded border bg-white dark:bg-black/60 px-3 py-2 text-[11px] font-mono text-slate-900 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none transition-colors resize-y shadow-sm ${
              runInputError ? "border-red-500" : "border-slate-300 dark:border-indigo-900/50 focus:border-indigo-500"
            }`}
          />
          {runInputError && (
            <p className="text-[10px] font-mono text-red-600 dark:text-red-400 font-semibold">[ JSON ERROR ] {runInputError}</p>
          )}
        </div>
      )}

      {/* Canvas */}
      <div className={clsx("flex-1 min-h-0", running ? "opacity-100" : "")}>
        <AgentGraphCanvas
          graph={graph}
          onChange={setGraph}
          executionId={activeExecutionId}
          traceHeaderExtra={
            activeExecutionId ? (
              <button
                type="button"
                onClick={() => setActiveExecutionId(null)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-500/50 text-[9px] text-slate-300 hover:border-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" /> BACK TO EDIT
              </button>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
