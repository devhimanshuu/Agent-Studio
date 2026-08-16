"use client";

import React from "react";
import { useTheme } from "next-themes";
import { UserProfile } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { Sliders, Sun, Moon, Cpu, ServerCog } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { ProviderStatus } from "@/types/settings";

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
          {status.runtimeReady ? "RUNTIME READY" : "NO KEYS SET"}
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
  const { resolvedTheme, setTheme } = useTheme();

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
      <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2 font-mono">
            <Moon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            APPEARANCE
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            aria-pressed={resolvedTheme === "dark"}
            className={`flex items-center gap-2 px-4 py-2 rounded border text-xs font-mono transition-all cursor-pointer ${
              resolvedTheme === "dark"
                ? "border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-500/30 font-semibold"
                : "border-slate-300 dark:border-indigo-900/40 bg-white dark:bg-[#0a0a0a] text-slate-700 dark:text-slate-400 hover:border-indigo-500 font-medium"
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            DARK
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            aria-pressed={resolvedTheme === "light"}
            className={`flex items-center gap-2 px-4 py-2 rounded border text-xs font-mono transition-all cursor-pointer ${
              resolvedTheme === "light"
                ? "border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-500/30 font-semibold"
                : "border-slate-300 dark:border-indigo-900/40 bg-white dark:bg-[#0a0a0a] text-slate-700 dark:text-slate-400 hover:border-indigo-500 font-medium"
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            LIGHT
          </button>
        </div>
        <p className="text-[10px] font-mono text-slate-600 dark:text-slate-500 font-medium">
          Agent Studio supports both dark terminal mode and crisp glassmorphic light mode.
        </p>
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
            routing="hash"
            appearance={{
              elements: {
                card: "bg-transparent border-0 shadow-none",
                navbar: "hidden",
                rootBox: "w-full",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
