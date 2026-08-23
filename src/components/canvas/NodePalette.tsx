"use client";

import React, { useState, useMemo } from "react";
import { CANVAS_NODE_TYPES } from "./nodeTypes";
import { GraphNodeType } from "@/types/graph";
import { Search, X } from "lucide-react";

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, type: GraphNodeType) => void;
  disabled?: boolean;
}

const CATEGORIES = [
  { id: "all", label: "ALL" },
  { id: "triggers", label: "TRIGGERS" },
  { id: "agent_core", label: "AGENT CORE" },
  { id: "actions_apis", label: "APIS & ACTIONS" },
  { id: "data_ops", label: "DATA OPS" },
] as const;

function getNodeCategory(type: GraphNodeType): "triggers" | "agent_core" | "actions_apis" | "data_ops" | "visuals" {
  if (type === "schedule_trigger" || type === "webhook_trigger" || type === "start" || type === "end") {
    return "triggers";
  }
  if (type === "agent" || type === "supervisor" || type === "router" || type === "approval" || type === "loop" || type === "parallel" || type === "subgraph") {
    return "agent_core";
  }
  if (
    type === "http" ||
    type === "rss_feed" ||
    type === "web_reader" ||
    type === "notification_dispatcher" ||
    type === "searxng_search" ||
    type === "crawl4ai_scrape" ||
    type === "docling_pdf_parser" ||
    type === "gotenberg_pdf_exporter" ||
    type === "audio_transcriber" ||
    type === "piper_tts" ||
    type === "tool" ||
    type === "mcp_server" ||
    type === "mcp_tool" ||
    type === "skill"
  ) {
    return "actions_apis";
  }
  if (
    type === "transform" ||
    type === "data_mapper" ||
    type === "nocodb_record" ||
    type === "pocketbase_store" ||
    type === "qdrant_vector_memory" ||
    type === "delay" ||
    type === "aggregate" ||
    type === "variable" ||
    type === "output"
  ) {
    return "data_ops";
  }
  return "visuals";
}

export function NodePalette({ onDragStart, disabled = false }: NodePaletteProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredNodes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return CANVAS_NODE_TYPES.filter((meta) => {
      const cat = getNodeCategory(meta.type);
      if (activeCategory !== "all") {
        if (cat !== activeCategory) return false;
      }
      if (!q) return true;
      return (
        meta.label.toLowerCase().includes(q) ||
        meta.type.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q) ||
        meta.tag.toLowerCase().includes(q)
      );
    });
  }, [search, activeCategory]);

  return (
    <div className="space-y-2.5 font-mono">
      <div className="px-1 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-bold">
            NODE PALETTE
          </div>
          <span className="text-[9px] text-slate-500 font-bold">
            {filteredNodes.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes (rss, jina, cron…)"
            className="w-full pl-6 pr-6 py-1 text-[9px] rounded bg-white dark:bg-[#07080f] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition-all ${
                activeCategory === cat.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-0.5 scrollbar-thin">
        {filteredNodes.map((meta) => {
          const Icon = meta.icon;
          return (
            <div
              key={meta.type}
              draggable={!disabled}
              onDragStart={(e) => onDragStart(e, meta.type)}
              title={meta.description}
              className={`group flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-[#0c0d18]/90 px-2.5 py-2 cursor-grab transition-all hover:border-indigo-400 dark:hover:border-indigo-500/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 shadow-xs hover:shadow-md ${
                disabled ? "opacity-40 cursor-not-allowed" : "active:cursor-grabbing hover:-translate-y-0.5"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-slate-800 dark:text-slate-100 tracking-wider truncate">{meta.label}</div>
                <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate">{meta.description}</div>
              </div>
              <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold ${meta.badgeClass} shrink-0`}>
                {meta.tag}
              </span>
            </div>
          );
        })}
        {filteredNodes.length === 0 && (
          <div className="text-center py-4 text-[9px] text-slate-400">
            No matching nodes found
          </div>
        )}
      </div>
    </div>
  );
}

