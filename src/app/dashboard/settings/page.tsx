"use client";

import React from "react";
import { useTheme } from "next-themes";
import { UserProfile, useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import {
  Sliders,
  Sun,
  Moon,
  Cpu,
  ServerCog,
  Palette,
  Lock,
  Search,
  Copy,
  Check,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Globe,
  Play,
  Loader2,
  Key,
  AlertCircle,
  Eye,
  EyeOff,
  Coins,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { ProviderStatus, ModelRosterItem } from "@/types/settings";
import { usePixelThemeTransition } from "@/components/effects/PixelThemeTransition";
import { SecretVault } from "@/components/vault/SecretVault";
import { formatPricePerMillion, isModelFree } from "@/lib/utils/pricing";
import { GroqOfficialLogo, OpenRouterOfficialLogo } from "@/components/common/BrandLogos";

async function fetchProviderStatus(): Promise<ProviderStatus> {
  const res = await fetch("/api/settings/providers");
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || "Failed to load provider status");
  return json.data;
}

function ProviderModelPanel({
  title,
  configured,
  modelCount,
  models,
  apiKeyEnvName,
  providerType = "groq",
  defaultOpen = false,
}: {
  title: string;
  configured: boolean;
  modelCount: number;
  models: ModelRosterItem[];
  apiKeyEnvName: string;
  providerType?: "groq" | "openrouter" | string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [pricingFilter, setPricingFilter] = React.useState<"all" | "free" | "paid">("all");
  const [copiedModel, setCopiedModel] = React.useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedModel(text);
    setTimeout(() => setCopiedModel(null), 1500);
  };

  const freeCount = React.useMemo(
    () => models.filter((m) => isModelFree(m.model, m.inputPrice, m.outputPrice)).length,
    [models]
  );
  const paidCount = models.length - freeCount;

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return models.filter((m) => {
      const isFree = isModelFree(m.model, m.inputPrice, m.outputPrice);
      if (pricingFilter === "free" && !isFree) return false;
      if (pricingFilter === "paid" && isFree) return false;
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
      if (!q) return true;
      if (q === "free" && isFree) return true;
      if (q === "paid" && !isFree) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        (m.category && m.category.toLowerCase().includes(q))
      );
    });
  }, [models, search, categoryFilter, pricingFilter]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [models]);

  const isGroq = providerType === "groq";

  return (
    <div
      className={clsx(
        "rounded-xl border shadow-sm transition-all overflow-hidden",
        configured
          ? "border-emerald-500/40 bg-emerald-50/20 dark:bg-[#0c0e18]/90"
          : "border-slate-200 dark:border-indigo-950/80 bg-slate-50/80 dark:bg-[#0a0a0f]/80"
      )}
    >
      {/* Dropdown Header Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none",
          isOpen
            ? "border-b border-slate-200 dark:border-indigo-950/80 bg-slate-100/60 dark:bg-black/40 hover:bg-slate-100 dark:hover:bg-black/60"
            : "hover:bg-slate-100/80 dark:hover:bg-indigo-950/30"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Official Provider Logo */}
          <div className="shrink-0 p-1 rounded-lg border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-black/80 shadow-xs flex items-center justify-center">
            {isGroq ? (
              <GroqOfficialLogo className="h-6 w-6" />
            ) : (
              <OpenRouterOfficialLogo className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-slate-100">
                {title}
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500">
                ({models.length} {models.length === 1 ? "MODEL" : "MODELS"})
              </span>
              <span
                className={clsx(
                  "text-[8.5px] font-mono px-1.5 py-0.2 rounded font-bold uppercase border",
                  isGroq
                    ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    : "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                )}
              >
                {isGroq ? "FREE LPU TIER" : "LIVE PRICING CATALOG"}
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {configured
                ? isGroq
                  ? `${models.length} ultra-fast models with sub-100ms inference on LPU hardware`
                  : `${freeCount} Free models ($0) + ${paidCount} Pay-As-You-Go models with live OpenRouter pricing`
                : `Requires ${apiKeyEnvName} configured in environment variables`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={clsx(
              "text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border shrink-0",
              configured
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700"
                : "bg-slate-200 dark:bg-indigo-950/60 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-indigo-900"
            )}
          >
            {configured ? "● ACTIVE" : "○ NOT CONFIGURED"}
          </span>

          <div
            className={clsx(
              "p-1 rounded-md text-slate-400 dark:text-slate-400 transition-transform duration-200",
              isOpen && "rotate-180 text-indigo-500 dark:text-indigo-400"
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </button>

      {/* Collapsible Dropdown Content Body */}
      {isOpen ? (
        <div className="p-4 sm:p-5 flex flex-col space-y-3 animate-fadeIn">
          {/* Search & Category Filter Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${models.length} models by name, category, 'free', or 'paid'...`}
                className="w-full pl-7 pr-6 py-1.5 text-[10px] rounded bg-white dark:bg-black/60 border border-slate-200 dark:border-indigo-950 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 font-mono transition-colors shadow-inner"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {/* Pricing Tabs & Category Filter Row */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
              {paidCount > 0 && (
                <div className="inline-flex rounded-md p-0.5 bg-slate-200/80 dark:bg-black/60 border border-slate-300/80 dark:border-indigo-950 text-[8px] font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => setPricingFilter("all")}
                    className={clsx(
                      "px-2 py-0.5 rounded transition-all cursor-pointer",
                      pricingFilter === "all"
                        ? "bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    ALL ({models.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingFilter("free")}
                    className={clsx(
                      "px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1",
                      pricingFilter === "free"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-emerald-500"
                    )}
                  >
                    <Sparkles className="h-2 w-2" />
                    FREE ({freeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingFilter("paid")}
                    className={clsx(
                      "px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1",
                      pricingFilter === "paid"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-indigo-400"
                    )}
                  >
                    <Coins className="h-2 w-2" />
                    PAID ({paidCount})
                  </button>
                </div>
              )}

              {/* Category Chips */}
              {categories.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("all")}
                    className={clsx(
                      "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-colors cursor-pointer",
                      categoryFilter === "all"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-200/80 dark:bg-black/40 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-indigo-950"
                    )}
                  >
                    {paidCount > 0 ? "ALL CATS" : `ALL (${models.length})`}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={clsx(
                        "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-colors cursor-pointer",
                        categoryFilter === cat
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200/80 dark:bg-black/40 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-indigo-950"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Model List Container */}
          <div className="flex-1 min-h-0 h-[380px] max-h-[460px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {filtered.map((item, idx) => {
              const isCopied = copiedModel === item.model;
              const isFree = isModelFree(item.model, item.inputPrice, item.outputPrice);
              const promptFormatted = formatPricePerMillion(item.inputPrice);
              const completionFormatted = formatPricePerMillion(item.outputPrice);

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-white dark:bg-[#07080f] border border-slate-200 dark:border-indigo-950/80 hover:border-indigo-500/50 space-y-1.5 shadow-xs transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="text-[11px] font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                        <span className="text-indigo-600 dark:text-indigo-400">▸</span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <code className="text-indigo-600 dark:text-indigo-300 font-semibold truncate select-all">
                          {item.model}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.model)}
                          title="Copy model ID"
                          className="text-slate-400 hover:text-indigo-400 transition-colors p-0.5 cursor-pointer shrink-0"
                        >
                          {isCopied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Category Pill */}
                    {item.category && (
                      <span
                        className={clsx(
                          "px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase tracking-wider shrink-0 border",
                          item.category === "code"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : item.category === "reasoning"
                            ? "border-purple-500/40 bg-purple-500/10 text-purple-400"
                            : item.category === "vision"
                            ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                            : item.category === "audio"
                            ? "border-pink-500/40 bg-pink-500/10 text-pink-400"
                            : item.category === "safety"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                            : item.category === "embedding"
                            ? "border-teal-500/40 bg-teal-500/10 text-teal-400"
                            : "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
                        )}
                      >
                        {item.category}
                      </span>
                    )}
                  </div>

                  {/* Specs & Performance & Pricing Strip */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-indigo-950/50 text-[8px] font-mono text-slate-500 dark:text-slate-400">
                    {item.contextLength && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-indigo-950">
                        {(item.contextLength / 1000).toFixed(0)}k ctx
                      </span>
                    )}
                    {item.throughput && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-indigo-950 text-emerald-600 dark:text-emerald-400 font-bold">
                        <Zap className="h-2.5 w-2.5" />
                        {item.throughput}
                      </span>
                    )}
                    {item.latency && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-indigo-950">
                        <Clock className="h-2.5 w-2.5" />
                        {item.latency}
                      </span>
                    )}

                    {/* Live Pricing Tag */}
                    {isFree ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold ml-auto flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
                        $0 FREE TIER
                      </span>
                    ) : (
                      <span
                        title={`Input: ${promptFormatted}/M tokens\nOutput: ${completionFormatted}/M tokens\nLive pricing from OpenRouter API`}
                        className="px-1.5 py-0.5 rounded bg-indigo-500/10 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-bold ml-auto flex items-center gap-1 cursor-help hover:border-indigo-400 transition-colors"
                      >
                        <Coins className="h-2.5 w-2.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                        <span className="text-slate-900 dark:text-slate-100 font-bold">{promptFormatted}/M in</span>
                        <span className="text-indigo-400 dark:text-indigo-600 font-normal">•</span>
                        <span className="text-slate-900 dark:text-slate-100 font-bold">{completionFormatted}/M out</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-8 text-[10px] text-slate-500 font-mono">
                No models match &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsOpen(true)}
          className="px-5 py-2.5 bg-slate-50/50 dark:bg-black/20 text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 dark:hover:bg-indigo-950/20 transition-colors"
        >
          <span>▸ Click dropdown header to expand and search {models.length} models</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-[9px]">EXPAND ▾</span>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ status }: { status: ProviderStatus }) {
  const groqList = (status.groqConfigured ? status.roster.groq : status.availableModels?.groq || []) as ModelRosterItem[];
  const openRouterList = (status.openRouterConfigured ? status.roster.openRouter : status.availableModels?.openRouter || []) as ModelRosterItem[];
  const [expandAll, setExpandAll] = React.useState(false);

  return (
    <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2 font-mono">
          <Cpu className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          AI PROVIDER STATUS & MODEL ROSTERS
        </h3>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpandAll(!expandAll)}
            className="text-[10px] font-mono px-2.5 py-1 rounded border border-slate-200 dark:border-indigo-950 bg-slate-100/70 dark:bg-black/60 text-slate-600 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer font-semibold flex items-center gap-1"
          >
            {expandAll ? "COLLAPSE ALL" : "EXPAND ALL"}
          </button>
          <span
            className={`text-[10px] font-mono px-2.5 py-1 rounded border font-semibold ${
              status.runtimeReady
                ? "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
                : "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
            }`}
          >
            {status.runtimeReady ? "● SYSTEM HEALTHY" : "▲ DEGRADED"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Groq Panel */}
        <ProviderModelPanel
          key={`groq-${expandAll}`}
          title="GROQ PROVIDER"
          configured={status.groqConfigured}
          modelCount={status.groqModels}
          models={groqList}
          apiKeyEnvName="GROQ_API_KEY"
          providerType="groq"
          defaultOpen={expandAll}
        />

        {/* OpenRouter Panel */}
        <ProviderModelPanel
          key={`openrouter-${expandAll}`}
          title="OPENROUTER PROVIDER"
          configured={status.openRouterConfigured}
          modelCount={status.openRouterModels}
          models={openRouterList}
          apiKeyEnvName="OPENROUTER_API_KEY"
          providerType="openrouter"
          defaultOpen={expandAll}
        />
      </div>
    </div>
  );
}

const SETTINGS_PRESET_ENDPOINTS = [
  { label: "Ollama (Local)", url: "http://localhost:11434/v1", model: "llama3.2", provider: "ollama" },
  { label: "Groq LPU", url: "https://api.groq.com/openai/v1", model: "groq/compound", provider: "groq" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1", model: "google/gemma-4-26b-a4b-it:free", provider: "openrouter" },
  { label: "OpenAI", url: "https://api.openai.com/v1", model: "gpt-4o", provider: "openai" },
  { label: "Together AI", url: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", provider: "together" },
  { label: "vLLM / LM Studio", url: "http://localhost:8000/v1", model: "custom-local", provider: "custom_openai" },
];

function CustomModelApiCard() {
  const [model, setModel] = React.useState("gpt-4o");
  const [apiBaseUrl, setApiBaseUrl] = React.useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    ok: boolean;
    latencyMs?: number;
    model?: string;
    reply?: string;
    error?: string;
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.trim() || "gpt-4o",
          apiKey: apiKey.trim() || undefined,
          apiBaseUrl: apiBaseUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.connected) {
        setTestResult({
          ok: true,
          latencyMs: data.latencyMs,
          model: data.model,
          reply: data.reply,
        });
      } else {
        setTestResult({
          ok: false,
          error: data.error || "Connection failed",
        });
      }
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 shadow-sm font-mono">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
          <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          CUSTOM MODEL API & ENDPOINT INTEGRATION
        </h3>
        <span className="text-[9px] px-2 py-0.5 rounded border border-indigo-400/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
          OPENAI-COMPATIBLE API
        </span>
      </div>

      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
        Connect any external OpenAI-compatible API endpoint directly to Agent Studio workflows — including local Ollama instances, private vLLM clusters, LM Studio, DeepSeek, Together AI, or corporate proxy gateways.
      </p>

      {/* Preset Quick Fill Buttons */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
          Quick Endpoint Presets:
        </span>
        <div className="flex flex-wrap gap-2">
          {SETTINGS_PRESET_ENDPOINTS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setApiBaseUrl(preset.url);
                setModel(preset.model);
              }}
              className={clsx(
                "px-2.5 py-1 rounded border text-[9px] font-bold transition-all cursor-pointer",
                apiBaseUrl === preset.url
                  ? "border-indigo-500 bg-indigo-600 text-white shadow-xs"
                  : "border-slate-300 dark:border-indigo-950 bg-slate-50 dark:bg-black/50 text-slate-700 dark:text-slate-300 hover:border-indigo-400"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Model ID */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-700 dark:text-slate-300">
            Model Identifier
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. gpt-4o, llama3.2, deepseek-chat"
            className="w-full px-3 py-1.5 text-xs rounded bg-white dark:bg-black/60 border border-slate-300 dark:border-indigo-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* API Base URL */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Globe className="h-3 w-3 text-indigo-500" /> API Base URL
          </label>
          <input
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="e.g. http://localhost:11434/v1"
            className="w-full px-3 py-1.5 text-xs rounded bg-white dark:bg-black/60 border border-slate-300 dark:border-indigo-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Key className="h-3 w-3 text-indigo-500" /> API Key (Optional for Local)
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-1.5 pr-8 text-xs rounded bg-white dark:bg-black/60 border border-slate-300 dark:border-indigo-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Test Bar & Status Output */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-indigo-950">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-500/20"
        >
          {testing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> TESTING ENDPOINT CONNECTIVITY…
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> TEST CUSTOM API CONNECTION
            </>
          )}
        </button>

        {testResult && (
          <div
            className={clsx(
              "px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 font-bold",
              testResult.ok
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : "border-red-400 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
            )}
          >
            {testResult.ok ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                <span>CONNECTED: {testResult.latencyMs}ms latency · Model &ldquo;{testResult.model}&rdquo; responding</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span>CONNECTION FAILED: {testResult.error}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountProfileCard({ theme }: { theme?: string }) {
  const { user } = useUser();
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 shadow-sm overflow-hidden transition-all">
      {/* Compact Executive Summary Bar */}
      <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName || "User Avatar"}
              className="h-9 w-9 rounded-full border border-indigo-500/40 object-cover shadow-sm shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <User className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                {user?.fullName || user?.username || "Authenticated Developer"}
              </span>
              <span className="text-[8px] font-mono px-1.5 py-0.2 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                ACTIVE
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
              {user?.primaryEmailAddress?.emailAddress || "Session ID Active"}
            </p>
          </div>
        </div>

        {/* Action Toggle Button */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono font-bold tracking-wider border border-indigo-300 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer shrink-0"
        >
          <span>{isExpanded ? "HIDE DETAILS" : "MANAGE ACCOUNT"}</span>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Collapsible Contained Clerk UserProfile with Compact Scroll */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-indigo-900/40 p-2 sm:p-4 max-h-[460px] overflow-y-auto scrollbar-thin bg-slate-50/50 dark:bg-black/40">
          <UserProfile
            key={theme}
            routing="hash"
            appearance={{
              variables:
                theme === "light"
                  ? {
                      colorPrimary: "#4f46e5",
                      colorBackground: "#ffffff",
                      colorText: "#0f172a",
                      colorTextSecondary: "#64748b",
                      colorInputBackground: "#f8fafc",
                      colorInputText: "#0f172a",
                      fontFamily: "JetBrains Mono, monospace",
                      borderRadius: "0.25rem",
                    }
                  : {
                      colorPrimary: "#818cf8",
                      colorBackground: "#000000",
                      colorText: "#e2e8f0",
                      colorTextSecondary: "#94a3b8",
                      colorInputBackground: "#0a0a0a",
                      colorInputText: "#ffffff",
                      fontFamily: "JetBrains Mono, monospace",
                      borderRadius: "0.25rem",
                    },
              elements: {
                card: "bg-transparent border-0 shadow-none text-slate-900 dark:text-slate-100 w-full",
                navbar: "hidden",
                rootBox: "w-full max-w-full",
                cardBox: "w-full shadow-none",
                scrollBox: "max-h-[420px] overflow-y-auto",
                profileSection: "border-b border-slate-200 dark:border-indigo-900/30 py-2",
                profileSectionTitleText:
                  theme === "light"
                    ? "font-mono font-semibold text-indigo-700 text-xs tracking-wide"
                    : "font-mono font-semibold text-indigo-300 text-xs tracking-wide",
                profileSectionSubtitleText: "font-mono text-slate-500 dark:text-slate-400 text-xs",
                profileSectionContent: "text-slate-800 dark:text-slate-200 font-mono text-xs",
                formFieldLabel: "font-mono text-xs text-slate-700 dark:text-slate-300",
                formFieldInput:
                  theme === "light"
                    ? "border border-slate-300 bg-white text-slate-900 font-mono text-xs focus:border-indigo-500 rounded py-1 px-2"
                    : "border border-indigo-900/50 bg-[#0a0a0a] text-slate-100 font-mono text-xs focus:border-indigo-400 rounded py-1 px-2",
                formButtonPrimary:
                  "border border-indigo-500 bg-indigo-600 font-mono text-xs font-semibold text-white hover:bg-indigo-500 rounded py-1.5 px-3",
                accordionTriggerButton: "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/40 py-1.5",
              },
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { theme } = useTheme();
  const { setThemeWithPixelTransition, isTransitioning } = usePixelThemeTransition();

  const { data: status, isLoading, isError, refetch } = useQuery<ProviderStatus>({
    queryKey: ["providerStatus"],
    queryFn: fetchProviderStatus,
  });

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide flex items-center gap-3">
            <Sliders className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            SYSTEM SETTINGS
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
            Configure LLM failover rosters, active API providers, theme preferences, and account profile.
          </p>
        </div>
      </div>

      {/* Appearance */}
      <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2 font-mono">
              <Palette className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              THEME & ENVIRONMENT AESTHETICS
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
              Select your preferred visual environment. All canvas nodes, charts, logs, and profile modules sync automatically.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              id: "dark",
              name: "Midnight Indigo",
              tag: "DARK",
              icon: Moon,
              desc: "Deep obsidian terminal with electric indigo & sky blue glowing accents.",
              bgCard: "bg-black/80",
              borderActive: "border-indigo-500 ring-2 ring-indigo-500/20 shadow-indigo-500/10",
              palette: ["#000000", "#6366f1", "#38bdf8"],
            },
            {
              id: "light",
              name: "Studio Crisp",
              tag: "LIGHT",
              icon: Sun,
              desc: "Daylight clean studio aesthetic with high-contrast text and sleek cards.",
              bgCard: "bg-white",
              borderActive: "border-indigo-600 ring-2 ring-indigo-600/20 shadow-indigo-600/10",
              palette: ["#ffffff", "#4f46e5", "#94a3b8"],
            },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = (theme === item.id) || (!theme && item.id === "dark");
            return (
              <button
                key={item.id}
                type="button"
                onClick={(e) => setThemeWithPixelTransition(item.id, e)}
                disabled={isTransitioning}
                aria-pressed={isActive}
                className={`p-4 rounded border text-left transition-all relative flex flex-col justify-between cursor-pointer group shadow-sm ${
                  isActive
                    ? `${item.borderActive} bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md`
                    : "border-slate-200 dark:border-indigo-900/40 bg-white/70 dark:bg-[#0a0a0a]/50 hover:border-indigo-400/60 dark:hover:border-indigo-500/60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-indigo-950/60 text-slate-700 dark:text-slate-300 group-hover:text-indigo-500"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        isActive
                          ? "border-indigo-400 bg-indigo-500 text-white"
                          : "border-slate-300 dark:border-indigo-900/60 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {isActive ? "[ ACTIVE ]" : item.tag}
                    </span>
                  </div>

                  <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                    {item.desc}
                  </p>
                </div>

                {/* Color Swatches preview */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/80 dark:border-indigo-900/30">
                  <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mr-1">PALETTE:</span>
                  {item.palette.map((color, cIdx) => (
                    <div
                      key={cIdx}
                      className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Providers */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-32 rounded" />
              <Skeleton className="h-32 rounded" />
            </div>
          </div>
        ) : isError || !status ? (
          <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 shadow-sm">
            <EmptyState
              title="Failed to load provider status"
              description="The server could not report LLM provider configuration."
              action={
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="px-3 py-1.5 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-colors cursor-pointer"
                >
                  [ RETRY ]
                </button>
              }
            />
          </div>
        ) : (
          <>
            <ProviderCard status={status} />
            <CustomModelApiCard />
          </>
        )}
      </div>

      {/* Profile */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ServerCog className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 font-mono">ACCOUNT & PROFILE</h3>
        </div>
        <AccountProfileCard theme={theme} />
      </div>

      {/* ───── Secret Vault Section ───── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-200">
          <Lock className="h-4 w-4 text-indigo-500" />
          ENVIRONMENT VAULT
        </div>
        <SecretVault />
      </div>
    </div>
  );
}
