"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plug, Loader2, Server, ShieldCheck, CircleAlert } from "lucide-react";
import { clsx } from "clsx";
import { McpServerDTO } from "@/types/mcp";
import { mcpToolRegistryName } from "@/modules/mcp/toolAdapter";

interface AvailableMcpToolsProps {
  /** Currently selected allowedTools (registry names). */
  selected: string[];
  onAdd: (registryName: string) => void;
}

/**
 * MCP tool allow-listing picker for the skill editor. Loads the user's MCP
 * servers and lets them add discovered tools to `allowedTools` by their
 * runtime registry name (`mcp_<serverId>_<toolName>`) — the exact string the
 * permission checker validates at execution time.
 */
export function AvailableMcpTools({ selected, onAdd }: AvailableMcpToolsProps) {
  const [servers, setServers] = useState<McpServerDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mcp/servers")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success === true) setServers(json.data ?? []);
        else setError(json?.error ?? "Failed to load MCP servers");
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load MCP servers");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-indigo-950/60 text-[10px] font-mono text-red-600 dark:text-red-400">
        <CircleAlert className="h-3 w-3 shrink-0" /> {error}
      </div>
    );
  }

  if (servers === null) {
    return (
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-indigo-950/60 text-[10px] font-mono text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin text-indigo-500" /> LOADING MCP TOOLS…
      </div>
    );
  }

  const populated = servers.filter((s) => s.cachedTools.length > 0);
  if (populated.length === 0) {
    return (
      <div className="pt-2 border-t border-slate-200 dark:border-indigo-950/60 space-y-1">
        <div className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-500 font-medium">
          MCP TOOLS
        </div>
        <p className="text-[10px] font-mono text-slate-500">
          No MCP tools discovered yet. Connect servers and rediscover tools in the{" "}
          <Link
            href="/dashboard/tools?tab=mcp"
            className="text-indigo-600 dark:text-indigo-400 underline decoration-dotted hover:text-indigo-500"
          >
            MCP Server Hub
          </Link>{" "}
          to allow-list them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-indigo-950/60">
      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-500 font-medium flex items-center gap-1">
        <Plug className="h-3 w-3 text-indigo-500" /> MCP TOOLS FROM CONNECTED SERVERS
      </div>
      {populated.map((server) => (
        <div key={server.id} className="space-y-1">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-indigo-700 dark:text-indigo-400/80 uppercase tracking-wider font-semibold">
            <Server className="h-3 w-3" />
            {server.name}
            <span className="text-slate-500 normal-case tracking-normal font-medium">
              · {server.cachedTools.length} tools
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {server.cachedTools.map((tool) => {
              const registryName = mcpToolRegistryName(server.id, tool.name);
              const isSelected = selected.includes(registryName);
              return (
                <button
                  key={registryName}
                  type="button"
                  onClick={() => onAdd(registryName)}
                  disabled={isSelected}
                  title={tool.description ?? `MCP tool "${tool.name}" on ${server.name}`}
                  className={clsx(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono transition-all cursor-pointer font-medium max-w-full",
                    isSelected
                      ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 opacity-80"
                      : "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:border-amber-400"
                  )}
                >
                  {isSelected && <span className="text-emerald-600 dark:text-emerald-400">✓</span>}
                  <span className="truncate">{registryName}</span>
                  {tool.isWrite && (
                    <span className="inline-flex items-center gap-0.5 text-[8px] uppercase tracking-wider font-semibold px-1 rounded bg-amber-200/60 dark:bg-amber-900/40">
                      <ShieldCheck className="h-2 w-2" /> HITL
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
