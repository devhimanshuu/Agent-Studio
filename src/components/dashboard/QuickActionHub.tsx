"use client";

import React, { useState, useRef, useEffect } from "react";
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

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
      <div className="relative z-50" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-semibold transition-all cursor-pointer ${
            dropdownOpen
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 shadow-sm"
              : "border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-black/50 text-slate-800 dark:text-slate-200 hover:border-indigo-400"
          }`}
        >
          <span>ACTIONS</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {dropdownOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 dark:border-indigo-800/80 bg-white dark:bg-[#0c0d14] shadow-2xl shadow-black/50 z-50 p-1.5 space-y-0.5 text-xs animate-fadeIn"
          >
            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Quick Actions
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false);
                onOpenQuickRun();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors text-left group"
            >
              <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-950/60 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/60 transition-colors">
                <Play className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-medium">Quick Test Run Skill</span>
            </button>

            <Link
              href="/dashboard/canvas/new"
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group"
            >
              <div className="p-1 rounded bg-indigo-100 dark:bg-indigo-950/60 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60 transition-colors">
                <Network className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="font-medium">New Multi-Agent Canvas</span>
            </Link>

            <Link
              href="/dashboard/knowledge"
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-700 dark:hover:text-violet-300 transition-colors group"
            >
              <div className="p-1 rounded bg-violet-100 dark:bg-violet-950/60 group-hover:bg-violet-200 dark:group-hover:bg-violet-900/60 transition-colors">
                <Database className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="font-medium">Ingest RAG Knowledge</span>
            </Link>

            <Link
              href="/dashboard/tools"
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 transition-colors group"
            >
              <div className="p-1 rounded bg-amber-100 dark:bg-amber-950/60 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/60 transition-colors">
                <Wrench className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-medium">Explore Tool Catalog</span>
            </Link>

            <div className="my-1 border-t border-slate-100 dark:border-indigo-950/60" />

            <Link
              href="/dashboard/skills/synthesizer"
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors group"
            >
              <div className="p-1 rounded bg-cyan-100 dark:bg-cyan-950/60 group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/60 transition-colors">
                <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <span className="font-medium">AI Skill Synthesizer</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
