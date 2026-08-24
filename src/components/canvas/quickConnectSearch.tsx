"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CANVAS_NODE_TYPES } from "./nodeTypes";
import { GraphNodeType } from "@/types/graph";
import { clsx } from "clsx";
import {
  Search,
  CircleDot,
  Target,
  Bot,
  GitFork,
  Wrench,
  Split,
  ShieldCheck,
  Repeat,
  Flag,
  Boxes,
  ServerCog,
  Plug,
  Puzzle,
  Globe,
  Shuffle,
  Timer,
  Layers,
  Variable,
  FileOutput,
  StickyNote,
  Frame,
  X,
  Clock,
  Radio,
  Rss,
  FileText,
  Send,
  Binary,
  FileSpreadsheet,
  FileCheck,
  HardDrive,
  Database,
  BrainCircuit,
  Mic,
  Volume2,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  start: CircleDot,
  end: Flag,
  agent: Bot,
  supervisor: GitFork,
  tool: Wrench,
  router: Split,
  approval: ShieldCheck,
  loop: Repeat,
  parallel: Target,
  subgraph: Boxes,
  mcp_server: ServerCog,
  mcp_tool: Plug,
  skill: Puzzle,
  http: Globe,
  transform: Shuffle,
  delay: Timer,
  aggregate: Layers,
  variable: Variable,
  output: FileOutput,
  schedule_trigger: Clock,
  webhook_trigger: Radio,
  rss_feed: Rss,
  web_reader: FileText,
  notification_dispatcher: Send,
  data_mapper: Binary,
  searxng_search: Search,
  crawl4ai_scrape: FileSpreadsheet,
  docling_pdf_parser: FileCheck,
  gotenberg_pdf_exporter: FileOutput,
  nocodb_record: Database,
  pocketbase_store: HardDrive,
  qdrant_vector_memory: BrainCircuit,
  audio_transcriber: Mic,
  piper_tts: Volume2,
  sticky_note: StickyNote,
  frame: Frame,
};

interface QuickConnectSearchProps {
  /** Position in viewport coordinates where the menu should appear. */
  position: { x: number; y: number };
  /** Called when the user selects a node type to create. */
  onSelect: (type: GraphNodeType) => void;
  /** Called to close the menu without selection. */
  onClose: () => void;
  /** The source node/edge handle this connection is being dragged from (for labeling hint). */
  sourceNodeId?: string;
}

/**
 * Quick-Connect Radial Search:
 * Pops up a fuzzy-search menu when a connection handle is dragged onto empty canvas space.
 * User can type to filter node types, then press Enter or click to drop + auto-wire.
 */
export function QuickConnectSearch({
  position,
  onSelect,
  onClose,
  sourceNodeId,
}: QuickConnectSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredTypes = useMemo(() => {
    const q = query.toLowerCase().trim();
    return CANVAS_NODE_TYPES.filter((meta) => {
      if (!q) return true;
      return (
        meta.type.includes(q) ||
        meta.label.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q) ||
        meta.tag.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredTypes.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && filteredTypes.length > 0) {
        e.preventDefault();
        onSelect(filteredTypes[selectedIndex].type);
      }
    },
    [filteredTypes, selectedIndex, onSelect, onClose]
  );

  // Clamp selected index when list shrinks
  useEffect(() => {
    if (selectedIndex >= filteredTypes.length) {
      setSelectedIndex(Math.max(0, filteredTypes.length - 1));
    }
  }, [filteredTypes.length, selectedIndex]);

  return (
    <div
      className="fixed z-[10000] pointer-events-auto"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -100%) translateY(-12px)" }}
    >
      <div
        className="rounded-xl border border-slate-200 dark:border-indigo-500/50 bg-white/98 dark:bg-[#0a0a14]/98 backdrop-blur-md p-2.5 shadow-2xl shadow-indigo-500/10 w-72 font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Quick Connect
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Source hint */}
        {sourceNodeId && (
          <div className="text-[8px] text-slate-500 mb-1.5 truncate">
            from: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{sourceNodeId}</span> →
          </div>
        )}

        {/* Search input */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700/60 bg-slate-50 dark:bg-black/40 px-2.5 py-1.5 mb-2">
          <Search className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search nodes… (↑↓ navigate, Enter select)"
            className="flex-1 bg-transparent text-[11px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none"
          />
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {filteredTypes.map((meta, i) => {
            const Icon = ICON_MAP[meta.type] ?? CircleDot;
            return (
              <button
                key={meta.type}
                onClick={() => onSelect(meta.type)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={clsx(
                  "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all cursor-pointer",
                  i === selectedIndex
                    ? "bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30"
                    : "border border-transparent hover:bg-slate-50 dark:hover:bg-white/5"
                )}
              >
                <Icon
                  className={clsx(
                    "h-4 w-4 shrink-0",
                    meta.accent.split(" ")[0]
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-900 dark:text-white tracking-wider">
                      {meta.label}
                    </span>
                    <span
                      className={clsx(
                        "px-1 py-0.5 rounded border text-[7px] font-bold tracking-wider",
                        meta.badgeClass
                      )}
                    >
                      {meta.tag}
                    </span>
                  </div>
                  <div className="text-[8px] text-slate-500 truncate mt-0.5">
                    {meta.description}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredTypes.length === 0 && (
            <div className="text-center py-4 text-[10px] text-slate-500">
              No matching node types
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
