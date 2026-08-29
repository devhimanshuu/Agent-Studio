"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronDown,
  Search,
  Zap,
  Bot,
  Sparkles,
  Check,
  Cpu,
  Eye,
  Volume2,
  ShieldAlert,
  Code2,
  Brain,
  X,
  Layers,
} from "lucide-react";
import { useModels } from "@/hooks/useModels";
import { ModelEntry } from "@/providers/llm";

export interface ModelDropdownProps {
  value?: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  filterCategory?: string;
  placeholder?: string;
  className?: string;
  showAutoRouter?: boolean;
  showCustomOption?: boolean;
  onSelectCustom?: () => void;
}

export function ModelDropdown({
  value,
  onChange,
  disabled = false,
  filterCategory,
  placeholder = "Select an AI model...",
  className = "",
  showAutoRouter = true,
  showCustomOption = true,
  onSelectCustom,
}: ModelDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>(filterCategory || "all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { groqModels, openRouterModels, openaiModels, allModels, isLoading } = useModels({
    category: filterCategory && filterCategory !== "all" ? filterCategory : undefined,
  });

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Find currently selected model
  const selectedModelEntry = useMemo(() => {
    if (!value || value === "") return null;
    return allModels.find((m) => m.model === value);
  }, [value, allModels]);

  // OpenRouter Free vs Paid split
  const openRouterFree = useMemo(() => {
    return openRouterModels.filter(
      (m) => m.model !== "openrouter/free" && (m.model.endsWith(":free") || m.inputPrice === 0)
    );
  }, [openRouterModels]);

  const openRouterPopular = useMemo(() => {
    return openRouterModels.filter(
      (m) => !m.model.endsWith(":free") && m.inputPrice !== 0 && m.model !== "openrouter/free"
    );
  }, [openRouterModels]);

  // Filtered lists based on search & filter chip
  const filterList = (list: ModelEntry[]) => {
    return list.filter((m) => {
      if (activeFilter === "free" && !(m.model.endsWith(":free") || m.inputPrice === 0 || m.provider === "groq")) {
        return false;
      }
      if (activeFilter === "groq" && m.provider !== "groq") return false;
      if (activeFilter === "openrouter" && m.provider !== "openrouter") return false;
      if (activeFilter === "reasoning" && m.category !== "reasoning") return false;
      if (activeFilter === "code" && m.category !== "code") return false;
      if (activeFilter === "vision" && m.category !== "vision") return false;
      if (activeFilter === "audio" && m.category !== "audio") return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.label.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        (m.category && m.category.toLowerCase().includes(q))
      );
    });
  };

  const filteredGroq = useMemo(() => filterList(groqModels), [groqModels, searchQuery, activeFilter]);
  const filteredORFree = useMemo(() => filterList(openRouterFree), [openRouterFree, searchQuery, activeFilter]);
  const filteredORPopular = useMemo(() => filterList(openRouterPopular), [openRouterPopular, searchQuery, activeFilter]);
  const filteredOpenAI = useMemo(() => filterList(openaiModels), [openaiModels, searchQuery, activeFilter]);

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case "reasoning":
        return <Brain className="h-3 w-3 text-purple-400" />;
      case "code":
        return <Code2 className="h-3 w-3 text-emerald-400" />;
      case "vision":
        return <Eye className="h-3 w-3 text-cyan-400" />;
      case "audio":
        return <Volume2 className="h-3 w-3 text-amber-400" />;
      case "safety":
        return <ShieldAlert className="h-3 w-3 text-rose-400" />;
      default:
        return <Bot className="h-3 w-3 text-indigo-400" />;
    }
  };

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleCustom = () => {
    setIsOpen(false);
    if (onSelectCustom) {
      onSelectCustom();
    } else {
      onChange("__custom__");
    }
  };

  return (
    <div ref={dropdownRef} className={`relative w-full font-mono ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all shadow-sm cursor-pointer ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-[#0d0f17]"
            : "border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-[#0a0a0c] hover:border-indigo-400 dark:hover:border-indigo-700"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {value === "openrouter/free" ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 animate-pulse" />
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                [Auto-Router] OpenRouter: Free Models (Recommended)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 shrink-0 font-bold">
                $0 FREE
              </span>
            </div>
          ) : value === "" || value === "auto-failover" ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Layers className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                [Failover Router] Multi-Provider (Groq + OpenRouter)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 shrink-0 font-bold">
                AUTO
              </span>
            </div>
          ) : value === "__custom__" ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Cpu className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="font-bold text-cyan-600 dark:text-cyan-300 truncate">
                Custom Model & API Endpoint
              </span>
            </div>
          ) : selectedModelEntry ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="shrink-0">{getCategoryIcon(selectedModelEntry.category)}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                {selectedModelEntry.label}
              </span>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase shrink-0">
                {selectedModelEntry.provider}
              </span>
              {selectedModelEntry.throughput && (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  {selectedModelEntry.throughput}
                </span>
              )}
            </div>
          ) : value ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Bot className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{value}</span>
            </div>
          ) : (
            <span className="text-slate-400 italic">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-indigo-500" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-indigo-500/40 bg-white dark:bg-[#0c0d14] shadow-2xl overflow-hidden animate-fadeIn backdrop-blur-md">
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-slate-200 dark:border-indigo-950/80 bg-slate-50/80 dark:bg-black/40 space-y-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models by name, ID, or capability..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-black/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Quick Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar text-[9px]">
              {[
                { id: "all", label: "ALL" },
                { id: "free", label: "FREE $0" },
                { id: "groq", label: "GROQ LPU" },
                { id: "openrouter", label: "OPENROUTER" },
                { id: "reasoning", label: "REASONING" },
                { id: "code", label: "CODE" },
                { id: "vision", label: "VISION" },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveFilter(chip.id)}
                  className={`px-2 py-0.5 rounded-full whitespace-nowrap font-bold transition-colors cursor-pointer ${
                    activeFilter === chip.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200/70 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model Options List */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-3 custom-scrollbar text-xs">
            {isLoading && (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Zap className="h-3.5 w-3.5 text-indigo-400 animate-spin" /> Fetching latest provider models...
              </div>
            )}

            {/* 1. Auto-Routers & Platform Defaults */}
            {showAutoRouter && (!searchQuery || "router auto failover".includes(searchQuery.toLowerCase())) && (
              <div className="space-y-1">
                <div className="px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Auto-Routers & Intelligent Failover
                </div>

                <div
                  onClick={() => handleSelect("openrouter/free")}
                  className={`px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    value === "openrouter/free"
                      ? "bg-indigo-600 text-white"
                      : "hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">OpenRouter: Free Models Auto-Router</div>
                      <div className="text-[9px] opacity-75">Auto-picks best available 0-cost reasoning model</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      $0 FREE
                    </span>
                    {value === "openrouter/free" && <Check className="h-3.5 w-3.5" />}
                  </div>
                </div>

                <div
                  onClick={() => handleSelect("")}
                  className={`px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    value === "" || value === "auto-failover"
                      ? "bg-indigo-600 text-white"
                      : "hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">Multi-Provider Failover Router</div>
                      <div className="text-[9px] opacity-75">Groq LPU first, falls back to OpenRouter</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      MULTI
                    </span>
                    {(value === "" || value === "auto-failover") && <Check className="h-3.5 w-3.5" />}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Groq LPU Models */}
            {filteredGroq.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Groq Ultra-Fast LPU Models ({filteredGroq.length})</span>
                  <span className="text-[8px] text-emerald-500 font-normal">Sub-100ms Inference</span>
                </div>
                {filteredGroq.map((m) => {
                  const isSelected = value === m.model;
                  return (
                    <div
                      key={`groq-${m.model}`}
                      onClick={() => handleSelect(m.model)}
                      className={`px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getCategoryIcon(m.category)}
                        <div className="truncate">
                          <span className="font-semibold text-xs">{m.label}</span>
                          <span className="text-[9px] opacity-60 ml-2 font-mono">{m.model}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[8px]">
                        {m.throughput && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            {m.throughput}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}k` : "128k"} ctx
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. OpenRouter Free Tier Models */}
            {filteredORFree.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                  <span>OpenRouter Free Tier Models ({filteredORFree.length})</span>
                  <span className="text-[8px] text-amber-400 font-normal">$0 Cost</span>
                </div>
                {filteredORFree.map((m) => {
                  const isSelected = value === m.model;
                  return (
                    <div
                      key={`or-free-${m.model}`}
                      onClick={() => handleSelect(m.model)}
                      className={`px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getCategoryIcon(m.category)}
                        <div className="truncate">
                          <span className="font-semibold text-xs">{m.label}</span>
                          <span className="text-[9px] opacity-60 ml-2 font-mono truncate">{m.model}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[8px]">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                          FREE
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}k` : "128k"} ctx
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. OpenRouter Flagship Models */}
            {filteredORPopular.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                  <span>OpenRouter Flagship & Extended Catalog ({filteredORPopular.length})</span>
                </div>
                {filteredORPopular.slice(0, 40).map((m) => {
                  const isSelected = value === m.model;
                  return (
                    <div
                      key={`or-pop-${m.model}`}
                      onClick={() => handleSelect(m.model)}
                      className={`px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getCategoryIcon(m.category)}
                        <div className="truncate">
                          <span className="font-semibold text-xs">{m.label}</span>
                          <span className="text-[9px] opacity-60 ml-2 font-mono truncate">{m.model}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[8px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}k` : "128k"} ctx
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 5. OpenAI Direct Models */}
            {filteredOpenAI.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  OpenAI Direct Models ({filteredOpenAI.length})
                </div>
                {filteredOpenAI.map((m) => {
                  const isSelected = value === m.model;
                  return (
                    <div
                      key={`oa-${m.model}`}
                      onClick={() => handleSelect(m.model)}
                      className={`px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Bot className="h-3 w-3 text-emerald-400" />
                        <span className="font-semibold text-xs truncate">{m.label}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty Search Result */}
            {filteredGroq.length === 0 &&
              filteredORFree.length === 0 &&
              filteredORPopular.length === 0 &&
              filteredOpenAI.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 space-y-1">
                  <div>No provider models matching &ldquo;{searchQuery}&rdquo;</div>
                  <button
                    type="button"
                    onClick={() => handleSelect(searchQuery)}
                    className="text-[10px] text-indigo-400 underline hover:text-indigo-300 cursor-pointer"
                  >
                    Use custom model ID &ldquo;{searchQuery}&rdquo;
                  </button>
                </div>
              )}

            {/* 6. Custom BYOM Option */}
            {showCustomOption && (
              <div className="pt-2 border-t border-slate-200 dark:border-indigo-950/80">
                <div
                  onClick={handleCustom}
                  className="px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-cyan-600 dark:text-cyan-300 font-bold transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5" />
                    <div>
                      <div className="text-xs">Custom Model & API Endpoint (BYOM)...</div>
                      <div className="text-[9px] font-normal text-slate-400">
                        Ollama, Local vLLM, custom OpenAI endpoint
                      </div>
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90 opacity-60" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
