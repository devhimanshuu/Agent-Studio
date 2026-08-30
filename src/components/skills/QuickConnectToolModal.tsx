"use client";

import React, { useState } from "react";
import {
  X,
  Search,
  Globe,
  Plus,
  Check,
  Loader2,
  Wrench,
  Info,
} from "lucide-react";
import { clsx } from "clsx";
import { OPENAPI_PRESETS, OpenApiPreset } from "@/modules/openapi/presets";
import { BUILT_IN_TOOL_CATALOG } from "@/modules/tools";
import { openApiToolRegistryName } from "@/modules/openapi/dynamicTool";
import { toast } from "@/stores/toastStore";

interface QuickConnectToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTools: string[];
  onAddTool: (toolName: string) => void;
}

export function QuickConnectToolModal({
  isOpen,
  onClose,
  selectedTools,
  onAddTool,
}: QuickConnectToolModalProps) {
  const [tab, setTab] = useState<"PUBLIC_PRESETS" | "BUILTIN">("PUBLIC_PRESETS");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [installingPresetId, setInstallingPresetId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter Public Presets
  const filteredPresets = OPENAPI_PRESETS.filter((preset) => {
    const matchesCat = categoryFilter === "ALL" || preset.category === categoryFilter;
    const matchesSearch =
      !search ||
      preset.name.toLowerCase().includes(search.toLowerCase()) ||
      preset.description.toLowerCase().includes(search.toLowerCase()) ||
      preset.endpoints.some((ep) => ep.summary.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Filter Built-in Tools
  const filteredBuiltins = BUILT_IN_TOOL_CATALOG.filter((tool) => {
    const matchesCat = categoryFilter === "ALL" || tool.category === categoryFilter;
    const matchesSearch =
      !search ||
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleInstallAndAddPreset = async (preset: OpenApiPreset) => {
    setInstallingPresetId(preset.id);
    try {
      // 1. Post to API to save integration if not already saved
      const res = await fetch("/api/openapi/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preset.name,
          description: preset.description,
          baseUrl: preset.baseUrl,
          authType: "NONE",
          endpoints: preset.endpoints,
        }),
      });

      const json = await res.json();
      const integrationId = json?.data?.id || preset.id;

      // 2. Add first endpoint or all endpoints to selectedTools in form
      let addedCount = 0;
      for (const ep of preset.endpoints) {
        const regName = openApiToolRegistryName(integrationId, ep.operationId);
        if (!selectedTools.includes(regName)) {
          onAddTool(regName);
          addedCount++;
        }
      }

      toast.success(
        "Tool Pack Connected!",
        `Added ${addedCount || preset.endpoints.length} endpoints from "${preset.name}" directly to your skill.`
      );
    } catch {
      toast.error("Failed to connect preset", "Could not register endpoints");
    } finally {
      setInstallingPresetId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-[#0d0d12] shadow-2xl overflow-hidden font-mono flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-indigo-900/60 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-purple-50/40 dark:from-indigo-950/40 dark:to-purple-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                Quick-Connect Tools & Public APIs
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                  Zero Form Loss
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-serif">
                Connect external public APIs and built-in execution engines without leaving this page.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-indigo-950/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab & Search Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-indigo-900/40 space-y-2 bg-slate-50/60 dark:bg-black/30">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-indigo-950/60 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTab("PUBLIC_PRESETS");
                  setCategoryFilter("ALL");
                }}
                className={clsx(
                  "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                  tab === "PUBLIC_PRESETS"
                    ? "bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Free Public APIs ({OPENAPI_PRESETS.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("BUILTIN");
                  setCategoryFilter("ALL");
                }}
                className={clsx(
                  "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                  tab === "BUILTIN"
                    ? "bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Built-In Engines ({BUILT_IN_TOOL_CATALOG.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search APIs, endpoints, tools…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Content Body Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === "PUBLIC_PRESETS" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPresets.map((preset) => {
                const isInstalling = installingPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/90 dark:bg-[#101018] shadow-sm hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex flex-col justify-between space-y-2.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {preset.name}
                          </h4>
                          <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {preset.badge}
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-indigo-950 text-[9px] font-bold text-slate-600 dark:text-indigo-300 uppercase">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif line-clamp-2 mt-1 leading-snug">
                        {preset.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between gap-2">
                      <div className="text-[9px] text-slate-500 font-mono">
                        {preset.endpoints.length} endpoints · {preset.baseUrl.replace(/^https?:\/\//, "")}
                      </div>

                      <button
                        type="button"
                        disabled={isInstalling}
                        onClick={() => handleInstallAndAddPreset(preset)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-500 shadow-sm shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {isInstalling ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        {isInstalling ? "CONNECTING..." : "ADD TO SKILL"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredBuiltins.map((tool) => {
                const isSelected = selectedTools.includes(tool.name);
                return (
                  <div
                    key={tool.name}
                    className={clsx(
                      "p-3.5 rounded-lg border shadow-sm transition-all flex flex-col justify-between space-y-2.5",
                      isSelected
                        ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30"
                        : "border-slate-200 dark:border-indigo-900/40 bg-white/90 dark:bg-[#101018]"
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Wrench className="h-3 w-3 text-indigo-500" />
                          {tool.name}
                        </h4>
                        <span
                          className={clsx(
                            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                            tool.type === "WRITE"
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                              : "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300"
                          )}
                        >
                          {tool.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif line-clamp-2 mt-1 leading-snug">
                        {tool.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between gap-2">
                      <span className="text-[9px] text-slate-500 font-mono uppercase">
                        Category: {tool.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isSelected) {
                            onAddTool(tool.name);
                            toast.success("Tool Added", `"${tool.name}" added to allowed tools.`);
                          }
                        }}
                        disabled={isSelected}
                        className={clsx(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold shadow-sm transition-all shrink-0",
                          isSelected
                            ? "bg-emerald-600 text-white cursor-default"
                            : "bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer shadow-indigo-500/20"
                        )}
                      >
                        {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {isSelected ? "ALREADY ADDED" : "ADD TOOL"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-indigo-900/60 bg-slate-50 dark:bg-[#0a0a0e] flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 font-serif flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>Need full custom Swagger/OpenAPI URLs? Import them anytime via the <strong>Tool Registry</strong>.</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md border border-slate-300 dark:border-indigo-800 bg-white dark:bg-black text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
