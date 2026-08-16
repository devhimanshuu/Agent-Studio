"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Network, Sparkles } from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { CANVAS_TEMPLATES } from "@/components/canvas/AgentGraphTemplates";
import { createEmptyGraph } from "@/types/graph";
import { toast } from "@/stores/toastStore";

function NewCanvasForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const template = CANVAS_TEMPLATES.find((t) => t.id === templateId) ?? null;

  const [name, setName] = useState(template ? `${template.name}` : "");
  const [purpose, setPurpose] = useState(template ? template.description : "");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      skillsApi.create({
        name,
        purpose,
        instructions: template?.description ?? "Visual multi-agent graph.",
        allowedTools: ["document_search", "ai_extraction", "ai_classification", "deterministic_condition", "calculator", "final_report"],
        actionsRequiringApproval: [],
        maxExecutionSteps: 40,
        inputSchema: { type: "object", properties: {}, required: [] },
        outputSchema: { type: "object", properties: {} },
        graphDefinition: template?.graph ?? createEmptyGraph(),
      }),
    onSuccess: (skill) => {
      toast.success("Agent graph created", `Opening canvas for "${skill.name}".`);
      router.push(`/dashboard/canvas/${skill.id}`);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Failed to create graph";
      setError(msg);
      toast.error("Create failed", msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Graph name must be at least 2 characters.");
      return;
    }
    if (purpose.trim().length < 5) {
      setError("Purpose must be at least 5 characters.");
      return;
    }
    setError(null);
    createMutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/dashboard/canvas"
        className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 transition-colors font-semibold"
      >
        <ArrowLeft className="h-3 w-3" /> BACK TO CANVAS
      </Link>

      <div className="border-b border-slate-200 dark:border-indigo-950/80 pb-4">
        <h1 className="text-lg sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide flex items-center gap-2">
          <Network className="h-5 w-5 text-indigo-400" />
          NEW AGENT GRAPH
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
          {template
            ? `Starting from blueprint: ${template.name}`
            : "Start from a blank canvas and drag in your agents, tools, routers & gates."}
        </p>
      </div>

      {template && (
        <div className="rounded border border-violet-300 dark:border-violet-500/40 bg-violet-50/70 dark:bg-violet-950/20 p-4 space-y-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> BLUEPRINT PRELOADED
            </span>
            <span className="text-[9px] text-slate-500">
              {template.graph.nodes.length} nodes · {template.graph.edges.length} edges
            </span>
          </div>
          <p className="text-[11px] text-violet-900/80 dark:text-violet-200/80 leading-relaxed">{template.description}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 p-6 space-y-4 shadow-sm font-mono">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-semibold">
            Graph Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Multi-Agent Research Crew"
            className="w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-colors shadow-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-semibold">
            Purpose
          </label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            placeholder="What multi-agent outcome does this graph automate?"
            className="w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-colors resize-y shadow-sm"
          />
        </div>

        {error && <p className="text-[10px] font-mono text-red-500 font-semibold">[ ERROR ] {error}</p>}

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="inline-flex items-center gap-2 px-6 py-3 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all text-xs cursor-pointer disabled:opacity-50 w-full justify-center"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> CREATING GRAPH…
            </>
          ) : (
            "[ CREATE + OPEN CANVAS ]"
          )}
        </button>
      </form>
    </div>
  );
}

export default function NewCanvasPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center font-mono text-xs text-slate-500">[ LOADING… ]</div>}>
      <NewCanvasForm />
    </Suspense>
  );
}
