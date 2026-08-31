"use client";

import React, { use, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Camera, Network } from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { executionsApi } from "@/lib/api/executions";
import { AgentGraphCanvas } from "@/components/canvas/AgentGraphCanvas";
import { SkeletonSkillDetail } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";

/**
 * Read-only snapshot of a graph + its most recent execution trace. Safe to
 * share — the canvas renders without the editor chrome (no palette, no
 * inspector editing, no validation strips).
 */
export default function CanvasSnapshotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: skill, isLoading, isError } = useQuery({
    queryKey: ["skill", id],
    queryFn: () => skillsApi.get(id),
  });

  const draft = skill?.publishedVersion ?? skill?.currentDraft ?? skill?.versions?.[0] ?? null;

  const { data: pastExecutions = [] } = useQuery({
    queryKey: ["executions", "by-version", draft?.id],
    queryFn: () => executionsApi.list({ skillVersionId: draft!.id, limit: 5 }),
    enabled: Boolean(draft),
  });
  const lastExecution = pastExecutions[0] ?? null;
  const graph = draft?.graphDefinition ?? null;

  const coveredEdges = useMemo(() => {
    const ids = new Set<string>();
    for (const exec of pastExecutions) {
      const planner = exec.plannerOutput as Record<string, unknown> | null;
      const state = planner?.graph === true ? (planner.state as { traversedEdges?: string[] } | undefined) : undefined;
      for (const edgeId of state?.traversedEdges ?? []) ids.add(edgeId);
    }
    return Array.from(ids);
  }, [pastExecutions]);

  if (isLoading) return <SkeletonSkillDetail />;
  if (isError || !skill || !draft || !graph) {
    return (
      <EmptyState
        title="Snapshot not found"
        description="This graph snapshot does not exist or you do not have access to it."
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
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-indigo-950/80 pb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/dashboard/canvas/${skill.id}`}
            className="p-2 rounded border border-slate-200 dark:border-indigo-900/50 hover:border-indigo-400 text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
            title="Open in canvas editor"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Camera className="h-4 w-4 text-indigo-400" />
              <h1 className="text-base sm:text-xl font-pixel text-pixel-glow uppercase tracking-wide truncate">{skill.name}</h1>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold border border-violet-200 dark:border-violet-500/40 inline-flex items-center gap-1">
                <Network className="h-3 w-3" /> SNAPSHOT
              </span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 truncate font-mono">
              read-only · v{draft.versionNumber} · {graph.nodes.length} nodes · {graph.edges.length} edges
              {lastExecution ? ` · last run ${lastExecution.status}` : " · no runs yet"}
            </p>
          </div>
        </div>
        <Link
          href={`/dashboard/canvas/${skill.id}`}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-all text-xs font-mono cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" /> [ OPEN IN EDITOR ]
        </Link>
      </div>

      <div className="flex-1 min-h-0">
        <AgentGraphCanvas graph={graph} onChange={() => {}} readOnly executionId={lastExecution?.id ?? null} coverage={coveredEdges} />
      </div>
    </div>
  );
}
