"use client";

import React from "react";
import { UserProfile } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { Moon, Sun, Cpu, ServerCog, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ProviderStatus } from "@/types/settings";

async function fetchProviderStatus(): Promise<ProviderStatus> {
  const res = await fetch("/api/settings/providers");
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || "Failed to load provider status");
  return json.data;
}

function ProviderCard({ status }: { status: ProviderStatus }) {
  return (
    <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-mono">
          <Cpu className="h-4 w-4 text-indigo-400" />
          AI PROVIDER STATUS
        </h3>
        <span
          className={`text-[10px] font-mono px-2 py-1 rounded border ${
            status.runtimeReady
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
              : "border-amber-500/40 bg-amber-950/30 text-amber-300"
          }`}
        >
          {status.runtimeReady ? "RUNTIME READY" : "NO KEYS SET"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Groq */}
        <div
          className={`p-4 rounded border ${
            status.groqConfigured
              ? "border-emerald-500/30 bg-emerald-950/10"
              : "border-indigo-900/40 bg-[#0a0a0a]/60"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-slate-300">GROQ</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                status.groqConfigured
                  ? "bg-emerald-950/60 text-emerald-300"
                  : "bg-indigo-950/60 text-slate-400"
              }`}
            >
              {status.groqConfigured ? "CONFIGURED" : "NOT SET"}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500">
            {status.groqConfigured
              ? `${status.groqModels} free models in failover roster`
              : "Set GROQ_API_KEY to enable"}
          </p>
          {status.groqConfigured && status.roster.groq.length > 0 && (
            <ul className="mt-3 space-y-1">
              {status.roster.groq.slice(0, 3).map((label) => (
                <li key={label} className="text-[10px] font-mono text-indigo-300/80">
                  ▸ {label}
                </li>
              ))}
              {status.roster.groq.length > 3 && (
                <li className="text-[10px] font-mono text-slate-500">
                  +{status.roster.groq.length - 3} more
                </li>
              )}
            </ul>
          )}
        </div>

        {/* OpenRouter */}
        <div
          className={`p-4 rounded border ${
            status.openRouterConfigured
              ? "border-emerald-500/30 bg-emerald-950/10"
              : "border-indigo-900/40 bg-[#0a0a0a]/60"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-slate-300">OPENROUTER</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                status.openRouterConfigured
                  ? "bg-emerald-950/60 text-emerald-300"
                  : "bg-indigo-950/60 text-slate-400"
              }`}
            >
              {status.openRouterConfigured ? "CONFIGURED" : "NOT SET"}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500">
            {status.openRouterConfigured
              ? `${status.openRouterModels} free models in failover roster`
              : "Set OPENROUTER_API_KEY to enable"}
          </p>
          {status.openRouterConfigured && status.roster.openRouter.length > 0 && (
            <ul className="mt-3 space-y-1">
              {status.roster.openRouter.slice(0, 3).map((label) => (
                <li key={label} className="text-[10px] font-mono text-indigo-300/80">
                  ▸ {label}
                </li>
              ))}
              {status.roster.openRouter.length > 3 && (
                <li className="text-[10px] font-mono text-slate-500">
                  +{status.roster.openRouter.length - 3} more
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <p className="text-[10px] font-mono text-slate-600 flex items-center gap-1.5">
        <ShieldCheck className="h-3 w-3 text-emerald-500/60" />
        API keys are stored server-side only and are never exposed to the browser.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { data: status, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings", "providers"],
    queryFn: fetchProviderStatus,
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-950/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
            SETTINGS
          </h1>
          <p className="text-xs font-mono text-slate-500 mt-1">
            Workspace preferences, profile & AI provider configuration
          </p>
        </div>
      </div>

      {/* Appearance */}
      <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 font-mono">
            <Moon className="h-4 w-4 text-indigo-400" />
            APPEARANCE
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            aria-pressed={resolvedTheme === "dark"}
            className={`flex items-center gap-2 px-4 py-2 rounded border text-xs font-mono transition-all ${
              resolvedTheme === "dark"
                ? "border-indigo-400 bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "border-indigo-900/40 bg-[#0a0a0a] text-slate-400 hover:border-indigo-500/50"
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            DARK
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            aria-pressed={resolvedTheme === "light"}
            className={`flex items-center gap-2 px-4 py-2 rounded border text-xs font-mono transition-all ${
              resolvedTheme === "light"
                ? "border-indigo-400 bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "border-indigo-900/40 bg-[#0a0a0a] text-slate-400 hover:border-indigo-500/50"
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            LIGHT
          </button>
        </div>
        <p className="text-[10px] font-mono text-slate-600">
          Agent Studio is designed around a black terminal aesthetic — dark is recommended.
        </p>
      </div>

      {/* AI Providers */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60 space-y-4">
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
          <div className="p-6 rounded border border-indigo-900/40 bg-[#0a0a0a]/60">
            <EmptyState
              title="Failed to load provider status"
              description="The server could not report LLM provider configuration."
              action={
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="px-3 py-1.5 rounded border border-indigo-500/40 bg-indigo-950/40 text-xs font-mono text-indigo-300 hover:border-indigo-400 transition-colors cursor-pointer"
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
          <ServerCog className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-200 font-mono">ACCOUNT & PROFILE</h3>
        </div>
        <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 overflow-hidden">
          <UserProfile
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
