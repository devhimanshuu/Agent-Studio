"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Play,
  Network,
  Database,
  Plus,
  Wrench,
  ChevronDown,
  Sparkles,
  Zap,
} from "lucide-react";

interface QuickActionHubProps {
  onOpenQuickRun: () => void;
}

export function QuickActionHub({ onOpenQuickRun }: QuickActionHubProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 font-mono">
      {/* Primary 1-Click Quick Run Button */}
      <button
        type="button"
        onClick={onOpenQuickRun}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-emerald-400/80 bg-emerald-600 dark:bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-md shadow-emerald-500/20 transition-all text-xs cursor-pointer"
      >
        <Zap className="h-4 w-4 fill-white" />
        <span>QUICK RUN</span>
      </button>

      {/* Direct New Canvas Graph */}
      <Link
        href="/dashboard/canvas/new"
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold hover:border-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all text-xs"
      >
        <Network className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        <span>NEW GRAPH</span>
      </Link>

      {/* Direct Create New Skill */}
      <Link
        href="/dashboard/skills/new"
        className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-black/50 text-slate-800 dark:text-slate-200 font-semibold hover:border-indigo-400 transition-all text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>NEW SKILL</span>
      </Link>

      {/* Action Hub Dropdown for mobile & more actions */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-black/50 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:border-indigo-400 transition-all cursor-pointer"
        >
          <span>ACTIONS</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute right-0 mt-1.5 w-52 rounded-lg border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-[#0c0c10] shadow-xl z-40 p-1.5 space-y-1 text-xs animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenQuickRun();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors text-left"
              >
                <Play className="h-4 w-4 text-emerald-500" />
                <span>Quick Test Run Skill</span>
              </button>

              <Link
                href="/dashboard/canvas/new"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
              >
                <Network className="h-4 w-4 text-indigo-500" />
                <span>New Multi-Agent Canvas</span>
              </Link>

              <Link
                href="/dashboard/knowledge"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
              >
                <Database className="h-4 w-4 text-violet-500" />
                <span>Ingest RAG Knowledge</span>
              </Link>

              <Link
                href="/dashboard/tools"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
              >
                <Wrench className="h-4 w-4 text-amber-500" />
                <span>Explore Tool Catalog</span>
              </Link>

              <Link
                href="/dashboard/skills/synthesizer"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
              >
                <Sparkles className="h-4 w-4 text-cyan-500" />
                <span>AI Skill Synthesizer</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
