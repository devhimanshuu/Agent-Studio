"use client";

import React from "react";
import Link from "next/link";
import { Server, Database, Bot, Lock, Wrench, ArrowUpRight } from "lucide-react";
import { SystemHealthDTO } from "@/types/dashboard";

interface SystemHealthStripProps {
  health: SystemHealthDTO;
}

export function SystemHealthStrip({ health }: SystemHealthStripProps) {
  const mcpAllConnected = health.mcpServersTotal > 0 && health.mcpServersConnected === health.mcpServersTotal;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/70 dark:bg-[#070709]/80 backdrop-blur-md px-4 py-3 shadow-sm font-mono transition-all">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* Left Label */}
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-slate-700 dark:text-slate-300 uppercase shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span>SYSTEM RUNTIME & INTEGRATIONS</span>
        </div>

        {/* Integration Badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs w-full lg:w-auto">
          {/* MCP Servers */}
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-800 dark:text-slate-200 hover:border-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 transition-all text-[11px]"
            title="Manage Model Context Protocol servers"
          >
            <Server className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>MCP:</span>
            <span className="font-semibold text-indigo-700 dark:text-indigo-300">
              {health.mcpServersConnected}/{health.mcpServersTotal}
            </span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                health.mcpServersTotal === 0
                  ? "bg-slate-400"
                  : mcpAllConnected
                  ? "bg-emerald-500"
                  : "bg-amber-500"
              }`}
            />
          </Link>

          {/* RAG Knowledge Base */}
          <Link
            href="/dashboard/knowledge"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/30 text-slate-800 dark:text-slate-200 hover:border-violet-400 hover:bg-violet-100/60 dark:hover:bg-violet-900/40 transition-all text-[11px]"
            title="Manage pgvector document chunks and collections"
          >
            <Database className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <span>RAG:</span>
            <span className="font-semibold text-violet-700 dark:text-violet-300">
              {health.ragChunksCount.toLocaleString()} Chunks
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </Link>

          {/* A2A Protocol */}
          <Link
            href="/dashboard/a2a"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/50 dark:bg-cyan-950/30 text-slate-800 dark:text-slate-200 hover:border-cyan-400 hover:bg-cyan-100/60 dark:hover:bg-cyan-900/40 transition-all text-[11px]"
            title="Agent-to-Agent communication mesh"
          >
            <Bot className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>A2A MESH:</span>
            <span className="font-semibold text-cyan-700 dark:text-cyan-300">
              {health.a2aAgentsCount} Agents
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
          </Link>

          {/* Secrets Vault */}
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/30 text-slate-800 dark:text-slate-200 hover:border-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-all text-[11px]"
            title="Encrypted API keys and secrets"
          >
            <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>VAULT:</span>
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              {health.vaultSecretsCount} Keys
            </span>
          </Link>

          {/* Permitted Tools */}
          <Link
            href="/dashboard/tools"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30 text-slate-800 dark:text-slate-200 hover:border-emerald-400 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition-all text-[11px]"
            title="View system tool registry"
          >
            <Wrench className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>TOOLS:</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              {health.permittedToolsCount} Active
            </span>
            <ArrowUpRight className="h-3 w-3 text-slate-400 ml-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
