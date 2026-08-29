"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Play, ArrowUpRight, Wrench, Plus } from "lucide-react";
import { PinnedSkillDTO } from "@/types/dashboard";

interface PinnedSkillsLaunchpadProps {
  skills: PinnedSkillDTO[];
  onQuickRun: (skillId: string) => void;
}

export function PinnedSkillsLaunchpad({ skills, onQuickRun }: PinnedSkillsLaunchpadProps) {
  return (
    <div className="space-y-3 font-mono">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            PINNED SKILLS & 1-CLICK LAUNCHPAD
          </h3>
        </div>
        <Link
          href="/dashboard/skills"
          className="text-[11px] text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold flex items-center gap-1"
        >
          [ BROWSE ALL ] <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {skills.length === 0 ? (
        <div className="p-6 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/60 dark:bg-[#0a0a0a]/60 text-center space-y-3">
          <Sparkles className="h-6 w-6 text-indigo-500 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No skills created yet</h4>
            <p className="text-[11px] text-slate-500">
              Create your first AI skill with JSON schemas and permitted tools to run agent tasks.
            </p>
          </div>
          <Link
            href="/dashboard/skills/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-all shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> CREATE NEW SKILL
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="p-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-900/40">
                    v{skill.versionNumber}
                  </span>
                  <span className="text-[9px] text-slate-400 flex items-center gap-1">
                    <Wrench className="h-3 w-3 text-indigo-400" /> {skill.allowedTools.length} tools
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={skill.name}>
                  {skill.name}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans line-clamp-2 leading-relaxed">
                  {skill.purpose}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onQuickRun(skill.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-emerald-400 bg-emerald-600 text-white text-[10px] font-bold uppercase hover:bg-emerald-500 shadow-sm transition-all cursor-pointer"
                >
                  <Play className="h-3 w-3 fill-white" /> QUICK RUN
                </button>
                <Link
                  href={`/dashboard/skills/${skill.id}`}
                  className="p-1.5 rounded border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-indigo-950/30 text-slate-700 dark:text-slate-300 hover:border-indigo-400 transition-colors"
                  title="Edit skill configuration"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
