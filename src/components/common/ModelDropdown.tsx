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
  Activity,
  Coins,
} from "lucide-react";
import { useModels } from "@/hooks/useModels";
import { ModelEntry } from "@/providers/llm";
import { formatPricePerMillion, isModelFree } from "@/lib/utils/pricing";
import { GroqOfficialLogo, OpenRouterOfficialLogo } from "@/components/common/BrandLogos";

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

  const getCategoryIcon = (category?: string, isSelected?: boolean) => {
    const iconClass = `h-3.5 w-3.5 shrink-0 ${isSelected ? "text-white" : ""}`;
    switch (category) {
      case "reasoning":
        return <Brain className={`${iconClass} ${!isSelected ? "text-purple-400" : ""}`} />;
      case "code":
        return <Code2 className={`${iconClass} ${!isSelected ? "text-emerald-400" : ""}`} />;
      case "vision":
        return <Eye className={`${iconClass} ${!isSelected ? "text-cyan-400" : ""}`} />;
      case "audio":
        return <Volume2 className={`${iconClass} ${!isSelected ? "text-amber-400" : ""}`} />;
      case "safety":
        return <ShieldAlert className={`${iconClass} ${!isSelected ? "text-rose-400" : ""}`} />;
      default:
        return <Bot className={`${iconClass} ${!isSelected ? "text-indigo-400" : ""}`} />;
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
    <div ref={dropdownRef} className={`relative w-full font-mono select-none ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all shadow-sm cursor-pointer ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/30 bg-slate-100 dark:bg-black/90 text-slate-900 dark:text-slate-100"
            : "border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-100 dark:hover:bg-indigo-950/40 text-slate-900 dark:text-slate-100"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {value === "openrouter/free" ? (
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 animate-pulse" />
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-[11px]">
                [Auto-Router] OpenRouter: Free Models
              </span>
              <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 shrink-0 font-bold font-mono">
                $0 FREE
              </span>
            </div>
          ) : value === "" || value === "auto-failover" ? (
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-[11px]">
                [Failover Router] Multi-Provider (Groq + OpenRouter)
              </span>
              <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 shrink-0 font-bold font-mono">
                AUTO
              </span>
            </div>
          ) : value === "__custom__" ? (
            <div className="flex items-center gap-2 min-w-0">
              <Cpu className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="font-bold text-cyan-600 dark:text-cyan-300 truncate text-[11px]">
                Custom Model & API Endpoint
              </span>
            </div>
          ) : selectedModelEntry ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectedModelEntry.provider === "groq" ? (
                <GroqOfficialLogo className="h-4 w-4 shrink-0" />
              ) : selectedModelEntry.provider === "openrouter" ? (
                <OpenRouterOfficialLogo className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              ) : (
                getCategoryIcon(selectedModelEntry.category)
              )}
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-[11px]">
                {selectedModelEntry.label}
              </span>
              <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 uppercase shrink-0 font-bold">
                {selectedModelEntry.provider}
              </span>
              {isModelFree(selectedModelEntry.model, selectedModelEntry.inputPrice, selectedModelEntry.outputPrice) ? (
                selectedModelEntry.throughput ? (
                  <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 shrink-0 font-bold font-mono">
                    {selectedModelEntry.throughput}
                  </span>
                ) : (
                  <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 shrink-0 font-bold font-mono">
                    $0 FREE
                  </span>
                )
              ) : (
                <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 shrink-0 font-bold font-mono flex items-center gap-1">
                  <Coins className="h-2.5 w-2.5 text-indigo-400" />
                  {formatPricePerMillion(selectedModelEntry.inputPrice)}/M in
                </span>
              )}
            </div>
          ) : value ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Bot className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-[11px]">{value}</span>
            </div>
          ) : (
            <span className="text-slate-400 italic text-[11px]">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-indigo-400" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] rounded-xl border border-indigo-500/40 bg-white dark:bg-slate-950 shadow-2xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden animate-fadeIn backdrop-blur-xl">
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-slate-200 dark:border-indigo-950/90 bg-slate-50/90 dark:bg-black/60 space-y-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 400+ provider models by name or tag..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-slate-300 dark:border-indigo-900/70 bg-white dark:bg-black/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 font-mono"
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
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar text-[8.5px]">
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
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap font-bold transition-all cursor-pointer ${
                    activeFilter === chip.id
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/40"
                      : "bg-slate-200/80 dark:bg-slate-900 dark:border dark:border-indigo-950/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 dark:hover:bg-indigo-950/70"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model Options List */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-3 custom-scrollbar text-xs">
            {isLoading && (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Activity className="h-3.5 w-3.5 text-indigo-400 animate-spin" /> Fetching live provider models...
              </div>
            )}

            {/* 1. Auto-Routers & Platform Defaults */}
            {showAutoRouter && (!searchQuery || "router auto failover".includes(searchQuery.toLowerCase())) && (
              <div className="space-y-1">
                <div className="px-2.5 py-1 text-[9px] font-mono font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 rounded border border-indigo-200 dark:border-indigo-900/50 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-400" /> Auto-Routers & Failover Engine
                </div>

                <div
                  onClick={() => handleSelect("openrouter/free")}
                  className={`px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all border ${
                    value === "openrouter/free"
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                      : "border-transparent hover:border-indigo-300 dark:hover:border-indigo-800/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-bold text-xs">OpenRouter: Free Models Auto-Router</div>
                      <div className={`text-[9px] ${value === "openrouter/free" ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
                        Auto-picks best available 0-cost reasoning model
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                      $0 FREE
                    </span>
                    {value === "openrouter/free" && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>
                </div>

                <div
                  onClick={() => handleSelect("")}
                  className={`px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all border ${
                    value === "" || value === "auto-failover"
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                      : "border-transparent hover:border-indigo-300 dark:hover:border-indigo-800/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">Multi-Provider Failover Router</div>
                      <div className={`text-[9px] ${value === "" || value === "auto-failover" ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
                        Groq LPU first, falls back to OpenRouter
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                      MULTI
                    </span>
                    {(value === "" || value === "auto-failover") && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Groq LPU Models */}
            {filteredGroq.length > 0 && (
              <div className="space-y-1">
                <div className="px-2.5 py-1 text-[9px] font-mono font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 rounded border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GroqOfficialLogo className="h-3.5 w-3.5 rounded-xs shrink-0" />
                    Groq Ultra-Fast LPU Models ({filteredGroq.length})
                  </span>
                  <span className="text-[8px] text-emerald-500 dark:text-emerald-400 font-normal">Sub-100ms Inference</span>
                </div>
                {filteredGroq.map((m) => {
                  const isSelected = value === m.model;
                  return (
                    <div
                      key={`groq-${m.model}`}
                      onClick={() => handleSelect(m.model)}
                      className={`px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-semibold"
                          : "border-transparent hover:border-indigo-300 dark:hover:border-indigo-800/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getCategoryIcon(m.category, isSelected)}
                        <div className="truncate">
                          <div className="font-semibold text-xs leading-tight">{m.label}</div>
                          <div className={`text-[9px] font-mono leading-tight mt-0.5 truncate ${isSelected ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
                            {m.model}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[8px]">
                        {m.throughput && (
                          <span className={`px-1.5 py-0.5 rounded border font-bold font-mono ${
                            isSelected
                              ? "bg-white/20 text-white border-white/30"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          }`}>
                            {m.throughput}
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded border font-mono ${
                          isSelected
                            ? "bg-white/20 text-white border-white/30"
                            : "bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60"
                        }`}>
                          {m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}k` : "128k"} ctx
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. OpenRouter Free Tier Models */}
            {filteredORFree.length > 0 && (
              <div className="space-y-1">
                <div className="px-2.5 py-1 text-[9px] font-mono font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 rounded border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <OpenRouterOfficialLogo className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    OpenRouter Free Tier Models ({filteredORFree.length})
                  </span>
                  <span className="text-[8px] text-amber-500 dark:text-amber-400 font-bold">$0 Cost</span>
                </div>
                {filteredORFree.map((m) => {
                  const isSelected = value === m.model;
                  return (
                    <div
                      key={`or-free-${m.model}`}
                      onClick={() => handleSelect(m.model)}
                      className={`px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-semibold"
                          : "border-transparent hover:border-indigo-300 dark:hover:border-indigo-800/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getCategoryIcon(m.category, isSelected)}
                        <div className="truncate">
                          <div className="font-semibold text-xs leading-tight">{m.label}</div>
                          <div className={`text-[9px] font-mono leading-tight mt-0.5 truncate ${isSelected ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
                            {m.model}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[8px]">
                        <span className={`px-1.5 py-0.5 rounded border font-bold font-mono ${
                          isSelected
                            ? "bg-white/20 text-white border-white/30"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        }`}>
                          FREE
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border font-mono ${
                          isSelected
                            ? "bg-white/20 text-white border-white/30"
                            : "bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60"
                        }`}>
                          {m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}k` : "128k"} ctx
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. OpenRouter Flagship Models */}
            {filteredORPopular.length > 0 && (
              <div className="space-y-1">
                <div className="px-2.5 py-1 text-[9px] font-mono font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 rounded border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <OpenRouterOfficialLogo className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    OpenRouter Flagship Catalog ({filteredORPopular.length})
                  </span>
                </div>
                {filteredORPopular.slice(0, 40).map((m) => {
                  const isSelected = value === m.model;
                  return (
                    <div
                      key={`or-pop-${m.model}`}
                      onClick={() => handleSelect(m.model)}
                      className={`px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-semibold"
                          : "border-transparent hover:border-indigo-300 dark:hover:border-indigo-800/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getCategoryIcon(m.category, isSelected)}
                        <div className="truncate">
                          <div className="font-semibold text-xs leading-tight">{m.label}</div>
                          <div className={`text-[9px] font-mono leading-tight mt-0.5 truncate ${isSelected ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
                            {m.model}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[8px]">
                        <span
                          title={`Input: ${formatPricePerMillion(m.inputPrice)}/M · Output: ${formatPricePerMillion(m.outputPrice)}/M`}
                          className={`px-1.5 py-0.5 rounded border font-mono font-bold flex items-center gap-1 ${
                            isSelected
                              ? "bg-white/20 text-white border-white/30"
                              : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                          }`}
                        >
                          <Coins className="h-2 w-2 text-indigo-400 shrink-0" />
                          {formatPricePerMillion(m.inputPrice)}/M in
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border font-mono ${
                          isSelected
                            ? "bg-white/20 text-white border-white/30"
                            : "bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60"
                        }`}>
                          {m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}k` : "128k"} ctx
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 5. OpenAI Direct Models */}
            {filteredOpenAI.length > 0 && (
              <div className="space-y-1">
                <div className="px-2.5 py-1 text-[9px] font-mono font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 rounded border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between">
                  <span>OpenAI Direct Models ({filteredOpenAI.length})</span>
                </div>
                {filteredOpenAI.map((m) => {
                  const isSelected = value === m.model;
                  return (
                    <div
                      key={`oa-${m.model}`}
                      onClick={() => handleSelect(m.model)}
                      className={`px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-semibold"
                          : "border-transparent hover:border-indigo-300 dark:hover:border-indigo-800/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Bot className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-emerald-400"}`} />
                        <span className="font-semibold text-xs truncate">{m.label}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-white" />}
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
                <div className="p-4 text-center text-xs text-slate-400 space-y-1.5">
                  <div>No provider models matching &ldquo;{searchQuery}&rdquo;</div>
                  <button
                    type="button"
                    onClick={() => handleSelect(searchQuery)}
                    className="inline-block px-3 py-1 rounded bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-500 cursor-pointer shadow-sm"
                  >
                    Select &ldquo;{searchQuery}&rdquo; as Custom Model
                  </button>
                </div>
              )}

            {/* 6. Custom BYOM Option */}
            {showCustomOption && (
              <div className="pt-2 border-t border-slate-200 dark:border-indigo-950/90">
                <div
                  onClick={handleCustom}
                  className="px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 text-cyan-600 dark:text-cyan-300 font-bold transition-all border border-transparent hover:border-cyan-500/40"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                    <div>
                      <div className="text-xs">Custom Model & API Endpoint (BYOM)...</div>
                      <div className="text-[9px] font-normal text-slate-500 dark:text-slate-400">
                        Ollama, Local vLLM, custom OpenAI compatible endpoint
                      </div>
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90 opacity-60 text-cyan-400" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
