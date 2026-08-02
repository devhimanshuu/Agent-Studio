import React from "react";
import { Sparkles, Plus } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Reveal } from "@/components/Reveal";

export default function SkillsPage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto font-mono">
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-950/80 pb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-pixel text-pixel-glow uppercase tracking-tight flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-indigo-400" />
              SKILLS STUDIO
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Define, schema-validate, and version reusable agent skills.
            </p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all">
            <Plus className="h-4 w-4" />
            [ CREATE SKILL ]
          </button>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <EmptyState
          title="No skills registered"
          description="Create your first skill definition with name, purpose, input/output schemas, and allowed tools."
          action={
            <button className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500">
              [ CREATE FIRST SKILL ]
            </button>
          }
        />
      </Reveal>
    </div>
  );
}
