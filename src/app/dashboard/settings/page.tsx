"use client";

import React from "react";
import { useTheme } from "next-themes";
import { UserProfile } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { Sliders, Sun, Moon, Cpu, ServerCog, Palette, Zap, Terminal, Sparkles, Lock } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { ProviderStatus } from "@/types/settings";
import { usePixelThemeTransition } from "@/components/effects/PixelThemeTransition";
import { SecretVault } from "@/components/vault/SecretVault";

async function fetchProviderStatus(): Promise<ProviderStatus> {
  const res = await fetch("/api/settings/providers");
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || "Failed to load provider status");
  return json.data;
}

function ProviderCard({ status }: { status: ProviderStatus }) {
  return (
    <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2 font-mono">
          <Cpu className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          AI PROVIDER STATUS
        </h3>
        <span
          className={`text-[10px] font-mono px-2 py-1 rounded border font-semibold ${
            status.runtimeReady
              ? "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
              : "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
          }`}
        >
          {status.runtimeReady ? "● SYSTEM HEALTHY" : "▲ DEGRADED"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Groq */}
        <div
          className={`p-4 rounded border flex flex-col justify-between ${
            status.groqConfigured
              ? "border-emerald-400 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/10"
              : "border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-[#0a0a0a]/60"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-900 dark:text-slate-300 font-bold tracking-wide">GROQ PROVIDER</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                  status.groqConfigured
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                    : "bg-slate-200 dark:bg-indigo-950/60 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-indigo-900"
                }`}
              >
                {status.groqConfigured ? "ACTIVE" : "NOT CONFIGURED"}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-3 font-medium">
              {status.groqConfigured
                ? `${status.groqModels} models active in failover roster:`
                : "Set GROQ_API_KEY to activate these models:"}
            </p>

            {/* Model Roster List */}
            <div className="space-y-1.5 border-t border-slate-200 dark:border-indigo-900/30 pt-2.5">
              {(status.groqConfigured ? status.roster.groq : status.availableModels?.groq || []).map((item, idx) => {
                const label = typeof item === "string" ? item : item.label;
                const modelId = typeof item === "object" ? item.model : null;
                return (
                  <div
                    key={idx}
                    className="p-2 rounded bg-white dark:bg-black/50 border border-slate-200 dark:border-indigo-900/40 space-y-0.5 shadow-sm"
                  >
                    <div className="text-[11px] font-mono font-semibold text-slate-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <span className="text-indigo-600 dark:text-indigo-500">▸</span> {label}
                    </div>
                    {modelId && (
                      <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate pl-3">
                        id: <code className="text-indigo-700 dark:text-indigo-300 font-semibold">{modelId}</code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* OpenRouter */}
        <div
          className={`p-4 rounded border flex flex-col justify-between ${
            status.openRouterConfigured
              ? "border-emerald-400 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/10"
              : "border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-[#0a0a0a]/60"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-900 dark:text-slate-300 font-bold tracking-wide">OPENROUTER PROVIDER</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                  status.openRouterConfigured
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                    : "bg-slate-200 dark:bg-indigo-950/60 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-indigo-900"
                }`}
              >
                {status.openRouterConfigured ? "ACTIVE" : "NOT CONFIGURED"}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-3 font-medium">
              {status.openRouterConfigured
                ? `${status.openRouterModels} models active in failover roster:`
                : "Set OPENROUTER_API_KEY to activate free models:"}
            </p>

            {/* Model Roster List */}
            <div className="space-y-1.5 border-t border-slate-200 dark:border-indigo-900/30 pt-2.5">
              {(status.openRouterConfigured ? status.roster.openRouter : status.availableModels?.openRouter || []).map((item, idx) => {
                const label = typeof item === "string" ? item : item.label;
                const modelId = typeof item === "object" ? item.model : null;
                return (
                  <div
                    key={idx}
                    className="p-2 rounded bg-white dark:bg-black/50 border border-slate-200 dark:border-indigo-900/40 space-y-0.5 shadow-sm"
                  >
                    <div className="text-[11px] font-mono font-semibold text-slate-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <span className="text-indigo-600 dark:text-indigo-500">▸</span> {label}
                    </div>
                    {modelId && (
                      <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate pl-3">
                        id: <code className="text-indigo-700 dark:text-indigo-300 font-semibold">{modelId}</code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
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
          <ProviderCard status={status} />
        )}
      </div>

      {/* Profile */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ServerCog className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 font-mono">ACCOUNT & PROFILE</h3>
        </div>
        <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 overflow-hidden shadow-sm">
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
                card: "bg-transparent border-0 shadow-none text-slate-900 dark:text-slate-100",
                navbar: "hidden",
                rootBox: "w-full",
                profileSection: "border-b border-slate-200 dark:border-indigo-900/30 py-4",
                profileSectionTitleText:
                  theme === "light"
                    ? "font-mono font-semibold text-indigo-700 text-xs tracking-wide"
                    : "font-mono font-semibold text-indigo-300 text-xs tracking-wide",
                profileSectionSubtitleText: "font-mono text-slate-500 dark:text-slate-400 text-xs",
                profileSectionContent: "text-slate-800 dark:text-slate-200 font-mono text-xs",
                formFieldLabel: "font-mono text-xs text-slate-700 dark:text-slate-300",
                formFieldInput:
                  theme === "light"
                    ? "border border-slate-300 bg-white text-slate-900 font-mono text-xs focus:border-indigo-500 rounded"
                    : "border border-indigo-900/50 bg-[#0a0a0a] text-slate-100 font-mono text-xs focus:border-indigo-400 rounded",
                formButtonPrimary:
                  "border border-indigo-500 bg-indigo-600 font-mono text-xs font-semibold text-white hover:bg-indigo-500 rounded py-2 px-3",
                accordionTriggerButton: "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/40",
              },
            }}
          />
        </div>
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
