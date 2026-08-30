"use client";

import React, { useCallback, useState } from "react";
import {
  Package,
  Trash2,
  GripVertical,
  Copy,
  Star,
  FolderOpen,
} from "lucide-react";
import type { Edge } from "@xyflow/react";
import type { AgentGraphDefinition, GraphNodeType } from "@/types/graph";
import type { CanvasNode } from "./graphUtils";

const STORAGE_KEY = "agent-studio-component-library";

interface MacroComponent {
  id: string;
  name: string;
  description: string;
  graph: AgentGraphDefinition;
  createdAt: number;
  tags: string[];
}

interface MacroLibraryProps {
  /** Current canvas nodes (for saving selections). */
  nodes: CanvasNode[];
  /** Current canvas edges. */
  edges: Edge[];
  /** IDs of currently selected nodes. */
  selectedNodeIds: Set<string>;
  /** Called when user wants to add a macro to the canvas. */
  onAddMacro: (graph: AgentGraphDefinition) => void;
  /** Whether the palette is visible. */
  isOpen: boolean;
  onToggle: () => void;
}

function loadLibrary(): MacroComponent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLibrary(components: MacroComponent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(components));
}

/**
 * Custom Reusable Macro Library ("My Components"):
 * Save subgraph selections to a workspace palette for drag-and-drop reuse.
 */
export function MacroLibrary({
  nodes,
  edges,
  selectedNodeIds,
  onAddMacro,
  isOpen: _isOpen,
  onToggle: _onToggle,
}: MacroLibraryProps) {
  const [components, setComponents] = useState<MacroComponent[]>(loadLibrary);
  const [savingName, setSavingName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [search, setSearch] = useState("");

  const saveSelection = useCallback(() => {
    if (!savingName.trim() || selectedNodeIds.size === 0) return;

    const selectedNodes = nodes.filter((n) => selectedNodeIds.has(n.id));
    const selectedEdges = edges.filter(
      (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
    );

    const graph: AgentGraphDefinition = {
      version: 1,
      nodes: selectedNodes.map((n) => ({
        id: n.id,
        type: (n.type ?? "agent") as GraphNodeType,
        position: { ...n.position },
        data: { ...n.data },
      })),
      edges: selectedEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: typeof e.label === "string" ? e.label : undefined,
      })),
    };

    const macro: MacroComponent = {
      id: `macro_${Date.now()}`,
      name: savingName.trim(),
      description: `${selectedNodes.length} nodes · ${selectedEdges.length} edges`,
      graph,
      createdAt: Date.now(),
      tags: [selectedNodes[0]?.type ?? "custom"],
    };

    const updated = [...components, macro];
    setComponents(updated);
    saveLibrary(updated);
    setSavingName("");
    setShowSave(false);
  }, [savingName, selectedNodeIds, nodes, edges, components]);

  const deleteMacro = useCallback(
    (id: string) => {
      const updated = components.filter((c) => c.id !== id);
      setComponents(updated);
      saveLibrary(updated);
    },
    [components]
  );

  const filtered = components.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q))
    );
  });

  return (
    <div className="space-y-2 font-mono">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-bold px-1 flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" /> MY COMPONENTS
        </div>
        <div className="flex items-center gap-1">
          {selectedNodeIds.size > 0 && (
            <button
              onClick={() => setShowSave(!showSave)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-400/50 bg-emerald-950/40 text-[8px] font-bold text-emerald-400 hover:bg-emerald-900/40 transition-colors cursor-pointer"
              title="Save selection as component"
            >
              <Star className="h-2.5 w-2.5" /> SAVE
            </button>
          )}
        </div>
      </div>

      {/* Save form */}
      {showSave && (
        <div className="rounded border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-2 space-y-1.5">
          <div className="text-[8px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">
            Save {selectedNodeIds.size} selected nodes as component
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSelection();
              }}
              placeholder="Component name…"
              className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/40 px-2 py-1 text-[9px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <button
              onClick={saveSelection}
              disabled={!savingName.trim()}
              className="px-2 py-1 rounded bg-emerald-600 text-white text-[8px] font-bold hover:bg-emerald-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              SAVE
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search components…"
        className="w-full rounded border border-slate-300 dark:border-slate-700/60 bg-white dark:bg-black/40 px-2.5 py-1.5 text-[9px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
      />

      {/* Component list */}
      <div className="space-y-1">
        {filtered.length === 0 && (
          <div className="text-center py-4 space-y-2">
            <FolderOpen className="h-6 w-6 mx-auto text-slate-600" />
            <p className="text-[9px] text-slate-500">
              {components.length === 0
                ? "No saved components yet. Select nodes and click SAVE."
                : "No matching components"}
            </p>
          </div>
        )}
        {filtered.map((macro) => (
          <div
            key={macro.id}
            className="group flex items-center gap-2 rounded border border-slate-200 dark:border-slate-700/60 bg-slate-50/90 dark:bg-[#0b0b12]/80 px-2.5 py-2 hover:border-indigo-400 dark:hover:border-indigo-400/70 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 transition-all"
          >
            <GripVertical className="h-3.5 w-3.5 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate">
                {macro.name}
              </div>
              <div className="text-[8px] text-slate-500 truncate">
                {macro.description}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onAddMacro(macro.graph)}
                className="p-1 rounded hover:bg-indigo-500/20 text-indigo-400 cursor-pointer"
                title="Add to canvas"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                onClick={() => deleteMacro(macro.id)}
                className="p-1 rounded hover:bg-red-500/20 text-red-400 cursor-pointer"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
