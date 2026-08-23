"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Plug,
  Server,
  Plus,
  X,
  Zap,
  RefreshCw,
  Trash2,
  Unplug,
  PlugZap,
  ChevronDown,
  ChevronRight,
  Braces,
  Activity,
  ShieldCheck,
  CircleAlert,
  Loader2,
  Terminal,
  Globe,
  KeyRound,
  Download,
  Upload,
  Search,
  Sparkles,
  Code,
  Database,
  Monitor,
  BookOpen,
  Cpu,
  Wrench,
  Check,
  Brain,
  LayoutGrid,
  List,
} from "lucide-react";
import { clsx } from "clsx";
import { ItemIcon } from "@/components/common/ItemIcon";
import {
  McpHealth,
  McpPreset,
  McpServerDTO,
  McpToolDefinition,
  McpToolTestResult,
  McpToolUpdate,
} from "@/types/mcp";
import { PublicMcpServer } from "@/types/mcp-directory";
import { MCP_PRESETS } from "@/modules/mcp/presets";
import { McpDirectoryBrowser } from "./McpDirectoryBrowser";
import { ToolUpdateDiffViewer } from "@/components/mcp/ToolUpdateDiffViewer";
import { ArrowUpCircle } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");

const statusTheme: Record<string, { chip: string; dot: string }> = {
  CONNECTED: {
    chip: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold",
    dot: "bg-emerald-500",
  },
  DISCONNECTED: {
    chip: "border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-indigo-950/30 text-slate-700 dark:text-slate-400 font-semibold",
    dot: "bg-slate-400",
  },
  ERROR: {
    chip: "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 font-semibold",
    dot: "bg-red-500",
  },
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };
  if (!res.ok || json.success === false) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  return json.data as T;
}

const PRESET_CATEGORIES = [
  { id: "ALL", label: "ALL PRESETS", icon: Sparkles },
  { id: "DEVELOPMENT", label: "DEV & CODE", icon: Code },
  { id: "DATABASE", label: "DATABASES", icon: Database },
  { id: "BROWSER", label: "BROWSER", icon: Monitor },
  { id: "WEB_SEARCH", label: "WEB & SEARCH", icon: Globe },
  { id: "PRODUCTIVITY", label: "PRODUCTIVITY", icon: Zap },
  { id: "REASONING", label: "REASONING", icon: Brain },
  { id: "DEVOPS", label: "DEVOPS", icon: Cpu },
  { id: "RESEARCH", label: "RESEARCH", icon: BookOpen },
  { id: "UTILITY", label: "UTILITIES", icon: Wrench },
];

export function McpServerHub() {
  const [servers, setServers] = useState<McpServerDTO[] | null>(null);
  const [presets, setPresets] = useState<McpPreset[]>(MCP_PRESETS);
  const [hubCatalogMode, setHubCatalogMode] = useState<"PRESETS" | "DIRECTORY">("PRESETS");
  const [presetCategory, setPresetCategory] = useState<string>("ALL");
  const [presetSearch, setPresetSearch] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectPreset, setConnectPreset] = useState<McpPreset | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, McpHealth>>({});
  const [serverViewMode, setServerViewMode] = useState<"list" | "grid">("list");
  const [pendingUpdates, setPendingUpdates] = useState<(McpToolUpdate & { affectedSkillNames: string[] })[]>([]);
  const [diffViewerUpdate, setDiffViewerUpdate] = useState<(McpToolUpdate & { affectedSkillNames: string[] }) | null>(null);

  const handleMountFromDirectory = useCallback(async (server: PublicMcpServer) => {
    // ── Deep integration: Composio toolkit ──
    if (server.source === "composio") {
      try {
        setBusy(server.id);
        const slug = server.id.replace("composio-", "");
        const res = await api<{ sessionId: string; mcpUrl: string; mcpHeaders: Record<string, string> }>(
          "/api/mcp/composio",
          { method: "POST", body: JSON.stringify({ toolkits: [slug] }) }
        );
        // Create the MCP server entry pointing to Composio's hosted MCP endpoint
        const created = await api<McpServerDTO>("/api/mcp/servers", {
          method: "POST",
          body: JSON.stringify({
            name: `${server.name} [Composio]`,
            transport: "SSE",
            endpointUrl: res.mcpUrl,
            headers: res.mcpHeaders,
            connectOnCreate: true,
          }),
        });
        setServers((prev) => [...(prev ?? []), created]);
        setBusy(null);
      } catch (e) {
        setBusy(null);
        setError(e instanceof Error ? e.message : "Failed to connect Composio toolkit");
      }
      return;
    }

    // ── Deep integration: Arcade integration ──
    if (server.source === "arcade") {
      try {
        setBusy(server.id);
        const slug = server.id.replace("arcade-", "");
        const res = await api<{ mcpUrl: string; mcpHeaders: Record<string, string>; verified: boolean }>(
          "/api/mcp/arcade",
          { method: "POST", body: JSON.stringify({ integration: slug }) }
        );
        const created = await api<McpServerDTO>("/api/mcp/servers", {
          method: "POST",
          body: JSON.stringify({
            name: `${server.name} [Arcade]`,
            transport: "SSE",
            endpointUrl: res.mcpUrl,
            headers: res.mcpHeaders,
            connectOnCreate: true,
          }),
        });
        setServers((prev) => [...(prev ?? []), created]);
        setBusy(null);
      } catch (e) {
        setBusy(null);
        setError(e instanceof Error ? e.message : "Failed to connect Arcade integration");
      }
      return;
    }

    // ── Standard MCP server mount ──
    const mappedPreset: McpPreset = {
      id: server.id,
      name: server.name,
      transport: server.transport,
      endpointUrl: server.endpointUrl,
      command: server.command,
      description: server.description,
      requiresAuthToken: Boolean(server.requiresAuthToken || (server.envVarsRequired && server.envVarsRequired.length > 0)),
      category: (server.category as any) || "UTILITY",
    };
    setConnectPreset(mappedPreset);
    setConnectOpen(true);
  }, []);

  const load = useCallback(async () => {
    try {
      setServers(await api<McpServerDTO[]>("/api/mcp/servers"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load MCP servers");
    }
  }, []);

  useEffect(() => {
    void load();
    api<McpPreset[]>("/api/mcp/presets")
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setPresets(list);
      })
      .catch(() => {});
    // Fetch pending tool updates
    api<(McpToolUpdate & { affectedSkillNames: string[] })[]>("/api/mcp/updates")
      .then((updates) => {
        if (Array.isArray(updates)) setPendingUpdates(updates);
      })
      .catch(() => {});
  }, [load]);

  const refresh = useCallback(
    async (serverId: string) => {
      setBusy(serverId);
      try {
        const updated = await api<McpServerDTO>(`/api/mcp/servers/${serverId}/connect`, {
          method: "POST",
          body: "{}",
        });
        setServers((prev) => (prev ?? []).map((s) => (s.id === serverId ? updated : s)));
        await probe(serverId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Connect failed");
        await load();
      } finally {
        setBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load]
  );

  const probe = useCallback(async (serverId: string) => {
    try {
      const h = await api<McpHealth>(`/api/mcp/servers/${serverId}/health`);
      setHealth((prev) => ({ ...prev, [serverId]: h }));
    } catch {
      // Health probes are best-effort.
    }
  }, []);

  const disconnect = useCallback(
    async (serverId: string) => {
      setBusy(serverId);
      try {
        const updated = await api<McpServerDTO>(`/api/mcp/servers/${serverId}/disconnect`, {
          method: "POST",
          body: "{}",
        });
        setServers((prev) => (prev ?? []).map((s) => (s.id === serverId ? updated : s)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Disconnect failed");
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const rediscover = useCallback(
    async (serverId: string) => {
      setBusy(serverId);
      try {
        const updated = await api<McpServerDTO>(`/api/mcp/servers/${serverId}/discover`, {
          method: "POST",
          body: "{}",
        });
        setServers((prev) => (prev ?? []).map((s) => (s.id === serverId ? updated : s)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Rediscovery failed");
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const handleBatchHealth = useCallback(async () => {
    if (!servers || servers.length === 0) return;
    setBatchBusy("health");
    try {
      const res = await api<McpHealth[]>("/api/mcp/servers/batch", {
        method: "POST",
        body: JSON.stringify({ action: "health" }),
      });
      const map: Record<string, McpHealth> = {};
      for (const h of res) {
        if (h.serverId) map[h.serverId] = h;
      }
      setHealth((prev) => ({ ...prev, ...map }));
      setSuccessMessage("Health probe completed for all servers");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch health check failed");
    } finally {
      setBatchBusy(null);
    }
  }, [servers]);

  const handleExport = useCallback(() => {
    window.open("/api/mcp/servers/export", "_blank");
  }, []);

  const [deleteTarget, setDeleteTarget] = useState<McpServerDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const confirmRemove = useCallback(async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    setBusy(deleteTarget.id);
    try {
      await api<unknown>(`/api/mcp/servers/${deleteTarget.id}`, { method: "DELETE" });
      setServers((prev) => (prev ?? []).filter((s) => s.id !== deleteTarget.id));
      setExpanded((prev) => (prev === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletePending(false);
      setBusy(null);
    }
  }, [deleteTarget]);

  const created = useCallback(async (server: McpServerDTO) => {
    setConnectOpen(false);
    setServers((prev) => [server, ...(prev ?? [])]);
    if (server.status === "CONNECTED") await probe(server.id);
  }, [probe]);

  const connectedCount = (servers ?? []).filter((s) => s.status === "CONNECTED").length;
  const totalTools = (servers ?? []).reduce((sum, s) => sum + s.cachedTools.length, 0);

  const filteredPresets = presets.filter((p) => {
    const matchesCategory = presetCategory === "ALL" || p.category === presetCategory;
    const matchesSearch =
      !presetSearch ||
      p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(presetSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 w-full">
      {/* Stats + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-700 dark:text-slate-400 px-3 py-2 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 shadow-sm font-semibold">
          <Server className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          {pad(servers?.length ?? 0)} SERVERS · {pad(connectedCount)} CONNECTED · {pad(totalTools)} TOOLS
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {servers && servers.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleBatchHealth}
                disabled={Boolean(batchBusy)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer disabled:opacity-50"
                title="Run live latency probes across all connected servers"
              >
                {batchBusy === "health" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                PROBE ALL
              </button>

              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer"
                title="Export all server configs as a portable JSON bundle"
              >
                <Download className="h-3 w-3" /> EXPORT
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setHubCatalogMode("DIRECTORY");
              const el = document.getElementById("mcp-catalog-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-indigo-300 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:border-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all cursor-pointer shadow-xs"
            title="Browse 120K+ MCP servers from Glama, mcp.so & Smithery"
          >
            <Globe className="h-3 w-3 text-indigo-500 animate-pulse" /> BROWSE REGISTRY
          </button>

          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer"
            title="Import MCP server configurations from JSON"
          >
            <Upload className="h-3 w-3" /> IMPORT
          </button>

          <button
            type="button"
            onClick={() => {
              setConnectPreset(null);
              setConnectOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 shadow-sm shadow-indigo-500/30 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Connect MCP Server
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-[11px] font-mono font-semibold">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" /> {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto cursor-pointer hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono font-semibold animate-fadeIn">
          <Check className="h-3.5 w-3.5 shrink-0" /> {successMessage}
          <button type="button" onClick={() => setSuccessMessage(null)} className="ml-auto cursor-pointer hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Presets & Directory Discovery Section */}
      <div id="mcp-catalog-section" className="space-y-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50/50 dark:bg-[#0a0a0a]/40 p-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950 pb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHubCatalogMode("PRESETS")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
                hubCatalogMode === "PRESETS"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Zap className={clsx("h-3.5 w-3.5", hubCatalogMode === "PRESETS" ? "fill-amber-400 text-amber-300" : "text-amber-500")} />
              1-CLICK ECOSYSTEM PRESETS ({presets.length})
            </button>

            <button
              type="button"
              onClick={() => setHubCatalogMode("DIRECTORY")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer relative",
                hubCatalogMode === "DIRECTORY"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Globe className="h-3.5 w-3.5 text-indigo-400" />
              PUBLIC REGISTRY (GLAMA & MCP.SO)
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[8px] bg-amber-400 text-black font-bold uppercase">
                120K+
              </span>
            </button>
          </div>            <div className="text-[10px] font-mono text-slate-500 hidden sm:block">
            {hubCatalogMode === "PRESETS"
              ? "CURATED ZERO-CONFIG REFERENCE PRESETS"
              : "LIVE DISCOVERY FROM GLAMA.AI, MCP.SO & SMITHERY"}
          </div>
        </div>

        {hubCatalogMode === "DIRECTORY" ? (
          <McpDirectoryBrowser
            onMount={handleMountFromDirectory}
            mountedServerIds={[
              ...(servers ?? []).map((s) => s.id),
              ...(servers ?? []).map((s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, "-")),
              ...(servers ?? []).map((s) => s.name.toLowerCase()),
            ]}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-bold">
                SELECT A LOCAL OR CLOUD TEMPLATE TO PREFILL CONNECTION
              </div>

              {/* Search box for presets */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search 22+ presets..."
                  className="w-full pl-8 pr-3 py-1 text-[11px] font-mono rounded border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-black/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
                {presetSearch && (
                  <button
                    type="button"
                    onClick={() => setPresetSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 overflow-x-auto pb-1">
              {PRESET_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const count =
                  cat.id === "ALL"
                    ? presets.length
                    : presets.filter((p) => p.category === cat.id).length;
                if (count === 0 && cat.id !== "ALL") return null;
                const active = presetCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPresetCategory(cat.id)}
                    className={clsx(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
                      active
                        ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                        : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-600 dark:text-slate-400 hover:border-indigo-400"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {cat.label} <span className="opacity-75 font-normal">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-2.5 pt-1">
              {filteredPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  onUse={() => {
                    setConnectPreset(preset);
                    setConnectOpen(true);
                  }}
                />
              ))}
              {filteredPresets.length === 0 && (
                <div className="col-span-full text-center py-6 text-xs font-mono text-slate-500">
                  No presets matching &quot;{presetSearch}&quot; in this category.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Server list */}
      <div className="space-y-3 pt-2">
        <div className="text-[11px] font-mono uppercase tracking-widest text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Server className="h-4 w-4 text-indigo-500" />
            CONFIGURED MCP SERVERS
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-normal text-slate-500 hidden sm:block">
              DISCOVERED TOOLS ARE AUTO-REGISTERED IN WORKFLOW RUNTIMES
            </span>
            {servers && servers.length > 0 && (
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-slate-100 dark:bg-black/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setServerViewMode("list")}
                  className={clsx(
                    "p-1.5 rounded text-xs font-mono transition-all cursor-pointer",
                    serverViewMode === "list"
                      ? "bg-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                  title="List View"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setServerViewMode("grid")}
                  className={clsx(
                    "p-1.5 rounded text-xs font-mono transition-all cursor-pointer",
                    serverViewMode === "grid"
                      ? "bg-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                  title="Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {servers === null ? (
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 px-3 py-6">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> LOADING MCP SERVERS…
          </div>
        ) : servers.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 dark:border-indigo-900/50 p-8 text-center space-y-2">
            <Plug className="h-6 w-6 text-indigo-400 mx-auto" />
            <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">NO MCP SERVERS CONFIGURED</p>
            <p className="text-[11px] font-mono text-slate-500">
              Select one of the 22+ 1-click presets above or connect a custom SSE endpoint or local stdio command.
            </p>
          </div>
        ) : (
          serverViewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {servers.map((server) => (
                <ServerGridCard
                  key={server.id}
                  server={server}
                  health={health[server.id]}
                  busy={busy === server.id}
                  hasUpdate={pendingUpdates.some((u) => u.serverId === server.id)}
                  onConnect={() => refresh(server.id)}
                  onDisconnect={() => disconnect(server.id)}
                  onDelete={() => setDeleteTarget(server)}
                  onHealth={() => probe(server.id)}
                  onInspect={() => setExpanded((prev) => (prev === server.id ? null : server.id))}
                />
              ))}
            </div>
          ) : (
          <div className="space-y-3">
            {servers.map((server) => (                <ServerCard
                  key={server.id}
                  server={server}
                  health={health[server.id]}
                  busy={busy === server.id}
                  expanded={expanded === server.id}
                  hasUpdate={pendingUpdates.some((u) => u.serverId === server.id)}
                  pendingUpdate={pendingUpdates.find((u) => u.serverId === server.id) || undefined}
                onToggle={() => setExpanded((prev) => (prev === server.id ? null : server.id))}
                onConnect={() => refresh(server.id)}
                onDisconnect={() => disconnect(server.id)}
                onRediscover={() => rediscover(server.id)}
                onDelete={() => setDeleteTarget(server)}
                onHealth={() => probe(server.id)}
                onViewUpdate={() => {
                  const update = pendingUpdates.find((u) => u.serverId === server.id);
                  if (update) setDiffViewerUpdate(update);
                }}
              />
            ))}
          </div>
          )
        )}
      </div>

      {connectOpen && (
        <ConnectModal
          initialPreset={connectPreset}
          presets={presets}
          onClose={() => setConnectOpen(false)}
          onCreated={created}
        />
      )}

      {importOpen && (
        <ImportMcpModal
          onClose={() => setImportOpen(false)}
          onImported={async () => {
            setImportOpen(false);
            await load();
            setSuccessMessage("MCP servers imported successfully");
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteMcpServerModal
          server={deleteTarget}
          isPending={deletePending}
          onClose={() => {
            if (!deletePending) setDeleteTarget(null);
          }}
          onConfirm={confirmRemove}
        />
      )}

      {diffViewerUpdate && (
        <ToolUpdateDiffViewer
          update={diffViewerUpdate}
          affectedSkillNames={diffViewerUpdate.affectedSkillNames}
          isOpen={true}
          onClose={() => setDiffViewerUpdate(null)}
          onApply={async (updateId, toolNames) => {
            const result = await api<{ changesApplied: number; skillsUpdated: number; errors: string[] }>(
              "/api/mcp/updates/apply",
              {
                method: "POST",
                body: JSON.stringify({ updateId, toolNames }),
              }
            );
            // Remove the applied update from state
            setPendingUpdates((prev) => prev.filter((u) => u.id !== updateId));
            setSuccessMessage(`Applied ${result.changesApplied} tool updates to ${result.skillsUpdated} skill(s)`);
            setTimeout(() => setSuccessMessage(null), 4000);
            // Refresh servers to reflect new tool cache
            await load();
          }}
        />
      )}
    </div>
  );
}

function ServerGridCard(props: {
  server: McpServerDTO;
  health?: McpHealth;
  busy: boolean;
  hasUpdate: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
  onHealth: () => void;
  onInspect: () => void;
}) {
  const { server, health } = props;
  const theme = statusTheme[server.status] ?? statusTheme.DISCONNECTED;
  const isConnected = server.status === "CONNECTED";

  return (
    <div onClick={props.onInspect} className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all p-4 flex flex-col justify-between space-y-3 cursor-pointer">
      {/* Top */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ItemIcon
              name={server.name}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                {server.name}
              </h3>
              <p className="text-[9px] font-mono text-slate-500 truncate">
                {server.transport === "SSE" ? server.endpointUrl : server.command}
              </p>
            </div>
          </div>
          <span className={clsx(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border shrink-0",
            theme.chip
          )}>
            <span className={clsx("h-1.5 w-1.5 rounded-full", theme.dot)} />
            {server.status}
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a]/60 text-slate-600 dark:text-slate-400">
            {server.transport}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a]/60 text-slate-600 dark:text-slate-400">
            {server.cachedTools.length} TOOLS
          </span>
          {props.hasUpdate && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 animate-pulse">
              <ArrowUpCircle className="h-2.5 w-2.5" /> UPDATE
            </span>
          )}
          {health && (
            <span className={clsx(
              "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border",
              health.status === "healthy" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" :
              health.status === "degraded" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" :
              "border-red-300 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
            )}>
              {health.status} · {health.latencyMs}ms
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-indigo-950/60">
        {isConnected ? (
          <button
            type="button"
            onClick={props.onDisconnect}
            disabled={props.busy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-indigo-900/50 text-[8px] font-mono uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all cursor-pointer disabled:opacity-50"
          >
            <Unplug className="h-2.5 w-2.5" /> DISCONNECT
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onConnect}
            disabled={props.busy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-500 bg-indigo-600 text-white text-[8px] font-mono uppercase tracking-wider font-semibold hover:bg-indigo-500 shadow-sm shadow-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <PlugZap className="h-2.5 w-2.5" /> CONNECT
          </button>
        )}
        <button
          type="button"
          onClick={props.onHealth}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-indigo-900/50 text-[8px] font-mono uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all cursor-pointer"
        >
          <Activity className="h-2.5 w-2.5" /> PROBE
        </button>
        <button
          type="button"
          onClick={props.onInspect}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-indigo-900/50 text-[8px] font-mono uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all cursor-pointer"
        >
          <Braces className="h-2.5 w-2.5" /> INSPECT
        </button>
        <button
          type="button"
          onClick={props.onDelete}
          disabled={props.busy}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 dark:border-red-500/30 text-[8px] font-mono uppercase tracking-wider font-semibold text-red-700 dark:text-red-300 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer disabled:opacity-50 ml-auto"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

function PresetCard({ preset, onUse }: { preset: McpPreset; onUse: () => void }) {
  return (
    <button
      type="button"
      onClick={onUse}
      title={preset.description}
      className="text-left rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/60 p-3 space-y-1.5 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ItemIcon
            name={preset.name}
            category={preset.category}
            size="xs"
          />
          <span className="text-[11px] font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">{preset.name}</span>
        </div>
        {preset.requiresAuthToken ? (
          <KeyRound className="h-3 w-3 text-amber-500 shrink-0" />
        ) : (
          <Globe className="h-3 w-3 text-indigo-400 shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider">
        <span
          className={clsx(
            "px-1.5 py-0.5 rounded border font-semibold",
            preset.transport === "SSE"
              ? "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300"
              : "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
          )}
        >
          {preset.transport}
        </span>
        <span className="text-slate-500 dark:text-slate-500">{preset.transport === "SSE" ? "REMOTE" : "LOCAL"}</span>
      </div>
      <p className="text-[9px] font-mono text-slate-500 leading-relaxed line-clamp-2">{preset.description}</p>
    </button>
  );
}

function ServerCard(props: {
  server: McpServerDTO;
  health?: McpHealth;
  busy: boolean;
  expanded: boolean;
  hasUpdate: boolean;
  pendingUpdate?: McpToolUpdate;
  onToggle: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRediscover: () => void;
  onDelete: () => void;
  onHealth: () => void;
  onViewUpdate: () => void;
}) {
  const { server, health, busy, expanded } = props;
  const theme = statusTheme[server.status] ?? statusTheme.DISCONNECTED;
  const isConnected = server.status === "CONNECTED";

  return (
    <div className="group rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:shadow-md transition-all p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
      {/* Left: Info, Badges */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <ItemIcon
            name={server.name}
            size="xs"
          />
          <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {server.name}
          </h3>
          <span className={clsx(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border",
            theme.chip
          )}>
            <span className={clsx("h-1.5 w-1.5 rounded-full", theme.dot)} />
            {server.status}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a]/60 text-slate-600 dark:text-slate-400">
            {server.transport}
          </span>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a]/60 text-slate-600 dark:text-slate-400">
            <Braces className="h-2.5 w-2.5" /> {server.cachedTools.length} TOOLS
          </span>
          {props.hasUpdate && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 animate-pulse">
              <ArrowUpCircle className="h-2.5 w-2.5" /> UPDATE AVAILABLE
            </span>
          )}
          {health && (
            <span className={clsx(
              "px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border",
              health.status === "healthy" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" :
              health.status === "degraded" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" :
              "border-red-300 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
            )}>
              {health.status} · {health.latencyMs}ms
            </span>
          )}
        </div>

        <p className="text-[9px] font-mono text-slate-500 truncate">
          {server.transport === "SSE" ? server.endpointUrl : server.command}
        </p>

        {server.lastError && server.status === "ERROR" && (
          <p className="text-[9px] font-mono text-red-700 dark:text-red-400 font-semibold break-all">⚠ {server.lastError}</p>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
            {isConnected ? (
              <ActionButton icon={Unplug} label="Disconnect" onClick={props.onDisconnect} disabled={busy} tone="neutral" />
            ) : (
              <ActionButton icon={PlugZap} label="Connect" onClick={props.onConnect} disabled={busy} tone="primary" />
            )}
            <ActionButton icon={RefreshCw} label="Rediscover" onClick={props.onRediscover} disabled={busy} tone="neutral" />
            {props.hasUpdate && (
              <button
                type="button"
                onClick={props.onViewUpdate}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-[8px] font-mono uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-all cursor-pointer"
              >
                <ArrowUpCircle className="h-3 w-3" /> VIEW UPDATE
              </button>
            )}
            <ActionButton icon={Trash2} label="Delete" onClick={props.onDelete} disabled={busy} tone="danger" />
            <button
              type="button"
              onClick={props.onToggle}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-indigo-900/50 text-[8px] font-mono uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 hover:border-indigo-400 transition-all cursor-pointer"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Inspect
            </button>
          </div>

      {expanded && <ToolInspector server={server} pendingUpdate={props.pendingUpdate} onViewUpdate={props.onViewUpdate} />}
    </div>
  );
}

function ActionButton(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "primary" | "neutral" | "danger";
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer disabled:opacity-50",
        props.tone === "primary" &&
          "border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/30",
        props.tone === "neutral" &&
          "border-slate-300 dark:border-indigo-900/50 text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300",
        props.tone === "danger" &&
          "border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
      )}
    >
      <Icon className="h-3 w-3" /> {props.label}
    </button>
  );
}

function generateSamplePayload(schema: Record<string, unknown> | undefined): string {
  if (!schema || typeof schema !== "object") return "{}";
  const properties = (schema.properties as Record<string, any>) || {};
  const sample: Record<string, any> = {};

  for (const [key, prop] of Object.entries(properties)) {
    if (prop.default !== undefined) {
      sample[key] = prop.default;
    } else if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
      sample[key] = prop.enum[0];
    } else if (prop.type === "string") {
      sample[key] = prop.example || (prop.description ? `<${prop.description.slice(0, 24)}>` : "sample_value");
    } else if (prop.type === "number" || prop.type === "integer") {
      sample[key] = prop.example ?? 1;
    } else if (prop.type === "boolean") {
      sample[key] = prop.example ?? true;
    } else if (prop.type === "array") {
      sample[key] = prop.example ?? [];
    } else if (prop.type === "object") {
      sample[key] = prop.example ?? {};
    } else {
      sample[key] = "";
    }
  }

  return Object.keys(sample).length > 0 ? JSON.stringify(sample, null, 2) : "{}";
}

type InspectorTab = "tools" | "resources" | "prompts" | "sampling" | "progress";

const INSPECTOR_TABS: { id: InspectorTab; label: string; icon: typeof Braces; count?: (s: McpServerDTO) => number }[] = [
  { id: "tools", label: "TOOLS", icon: Braces, count: (s) => s.cachedTools.length },
  { id: "resources", label: "RESOURCES", icon: Database },
  { id: "prompts", label: "PROMPTS", icon: BookOpen },
  { id: "sampling", label: "SAMPLING", icon: Brain },
  { id: "progress", label: "PROGRESS", icon: Activity },
];

function ToolInspector({ server, pendingUpdate, onViewUpdate }: { server: McpServerDTO; pendingUpdate?: McpToolUpdate; onViewUpdate?: () => void }) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("tools");
  const [activeTestTool, setActiveTestTool] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState<string | null>(null);

  return (
    <div className="border-t border-slate-200 dark:border-indigo-950/60 bg-slate-50/60 dark:bg-black/30">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-4 pt-3 border-b border-slate-200 dark:border-indigo-950/60">
        {INSPECTOR_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.count?.(server);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t text-[9px] font-mono font-semibold uppercase tracking-wider border border-b-0 transition-all cursor-pointer",
                isActive
                  ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-slate-300 dark:hover:border-indigo-800"
              )}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
              {count !== undefined && (
                <span className={clsx("ml-0.5 text-[8px] font-normal", isActive ? "text-indigo-200" : "text-slate-400")}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "tools" && (
          <ToolsTab server={server} activeTestTool={activeTestTool} setActiveTestTool={setActiveTestTool} schemaOpen={schemaOpen} setSchemaOpen={setSchemaOpen} pendingUpdate={pendingUpdate} onViewUpdate={onViewUpdate} />
        )}
        {activeTab === "resources" && <ResourcesTab server={server} />}
        {activeTab === "prompts" && <PromptsTab server={server} />}
        {activeTab === "sampling" && <SamplingTab server={server} />}
        {activeTab === "progress" && <ProgressTab server={server} />}
      </div>
    </div>
  );
}

/* ────────────── Tools Tab ────────────── */

function ToolsTab({ server, activeTestTool, setActiveTestTool, schemaOpen, setSchemaOpen, pendingUpdate, onViewUpdate }: {
  server: McpServerDTO;
  activeTestTool: string | null;
  setActiveTestTool: React.Dispatch<React.SetStateAction<string | null>>;
  schemaOpen: string | null;
  setSchemaOpen: React.Dispatch<React.SetStateAction<string | null>>;
  pendingUpdate?: McpToolUpdate;
  onViewUpdate?: () => void;
}) {
  return (
    <div className="space-y-3">
      {pendingUpdate && (
        <div className="flex items-center justify-between rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 uppercase">
              {pendingUpdate.changes.length} tool update(s) available
            </span>
          </div>
          {onViewUpdate && (
            <button
              type="button"
              onClick={onViewUpdate}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-amber-400 bg-amber-100 dark:bg-amber-900/40 text-[9px] font-mono font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
            >
              <ArrowUpCircle className="h-3 w-3" /> VIEW & UPGRADE
            </button>
          )}
        </div>
      )}
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-semibold flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Braces className="h-3.5 w-3.5" /> DISCOVERED TOOLS ({server.cachedTools.length})
        </span>
        <span className="text-[9px] text-slate-500 font-normal">
          Click TEST on any tool for live schema execution
        </span>
      </div>

      {server.cachedTools.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 dark:border-indigo-900/50 p-6 text-center space-y-1">
          <p className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
            No tools cached yet.
          </p>
          <p className="text-[11px] font-mono text-slate-500">
            Connect the server and run Rediscover to query the remote tools/list.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {server.cachedTools.map((tool) => {
            const isTesting = activeTestTool === tool.name;
            const isSchemaOpen = schemaOpen === tool.name;

            return (
              <li
                key={tool.name}
                className={clsx(
                  "rounded border bg-white/80 dark:bg-[#0a0a0a]/60 p-3 space-y-2 transition-all shadow-sm",
                  isTesting
                    ? "border-indigo-500/80 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                    : "border-slate-200 dark:border-indigo-900/40"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSchemaOpen((prev) => (prev === tool.name ? null : tool.name))}
                    className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-indigo-900 dark:text-indigo-200 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer min-w-0"
                  >
                    {isSchemaOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{tool.name}</span>
                  </button>

                  <span
                    className={clsx(
                      "px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider font-semibold",
                      tool.isWrite
                        ? "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                        : "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300"
                    )}
                  >
                    {tool.isWrite ? "WRITE" : "READ"}
                  </span>

                  {tool.requiresApproval && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 uppercase tracking-wider font-semibold text-[9px] font-mono">
                      <ShieldCheck className="h-2.5 w-2.5" /> HITL
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTestTool((prev) => (prev === tool.name ? null : tool.name))}
                    className={clsx(
                      "ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[9px] font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer",
                      isTesting
                        ? "border-indigo-400 bg-indigo-700 text-white shadow-sm"
                        : "border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/20"
                    )}
                  >
                    <Terminal className="h-3 w-3" />
                    {isTesting ? "CLOSE TEST" : "TEST TOOL"}
                  </button>
                </div>

                {tool.description && (
                  <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400">{tool.description}</p>
                )}

                {isSchemaOpen && (
                  <pre className="rounded border border-slate-200 dark:border-indigo-900/40 bg-black/40 dark:bg-black/60 p-2.5 text-[9px] text-slate-700 dark:text-slate-300 font-mono overflow-x-auto max-h-56 overflow-y-auto whitespace-pre">
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                )}

                {isTesting && <ToolTestConsole server={server} tool={tool} onClose={() => setActiveTestTool(null)} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ToolTestConsole({
  server,
  tool,
  onClose,
}: {
  server: McpServerDTO;
  tool: McpToolDefinition;
  onClose: () => void;
}) {
  const defaultPayload = React.useMemo(() => generateSamplePayload(tool.inputSchema), [tool.inputSchema]);
  const [args, setArgs] = useState(defaultPayload);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<McpToolTestResult | null>(null);

  // Sync default args if tool changes
  useEffect(() => {
    setArgs(generateSamplePayload(tool.inputSchema));
    setResult(null);
  }, [tool]);

  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(args);
      setArgs(JSON.stringify(parsed, null, 2));
    } catch {}
  };

  const handleReset = () => {
    setArgs(generateSamplePayload(tool.inputSchema));
    setResult(null);
  };

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(args || "{}");
      } catch {
        setResult({
          ok: false,
          toolName: tool.name,
          serverId: server.id,
          durationMs: 0,
          error: "Arguments must be valid JSON",
        });
        return;
      }
      const res = await api<McpToolTestResult>(`/api/mcp/servers/${server.id}/test`, {
        method: "POST",
        body: JSON.stringify({ toolName: tool.name, arguments: parsed }),
      });
      setResult(res);
    } catch (e) {
      setResult({
        ok: false,
        toolName: tool.name,
        serverId: server.id,
        durationMs: 0,
        error: e instanceof Error ? e.message : "Test failed",
      });
    } finally {
      setRunning(false);
    }
  };

  const properties = (tool.inputSchema?.properties as Record<string, any>) || {};
  const propKeys = Object.keys(properties);

  return (
    <div className="rounded border border-indigo-400/60 dark:border-indigo-700/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 space-y-3 mt-2 animate-fadeInUp">
      <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-900/50 pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
            INTERACTIVE RUNTIME TEST // {tool.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrettify}
            className="text-[9px] font-mono text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
          >
            [ FORMAT JSON ]
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="text-[9px] font-mono text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
          >
            [ RESET SAMPLE ]
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 cursor-pointer ml-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Schema parameter pills */}
      {propKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono">
          <span className="text-slate-500 font-semibold uppercase">EXPECTED PARAMS:</span>
          {propKeys.map((k) => {
            const p = properties[k];
            const isReq = Array.isArray(tool.inputSchema?.required) && tool.inputSchema.required.includes(k);
            return (
              <span
                key={k}
                title={p.description}
                className={clsx(
                  "px-1.5 py-0.5 rounded border",
                  isReq
                    ? "border-indigo-400 dark:border-indigo-600 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 font-bold"
                    : "border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-black/40 text-slate-700 dark:text-slate-300"
                )}
              >
                {k}: <span className="opacity-75">{p.type || "any"}</span>
                {isReq && <span className="text-red-500 ml-0.5">*</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* JSON Payload Editor */}
      <div className="space-y-1">
        <label className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 font-semibold flex items-center justify-between">
          <span>CALL ARGUMENTS (JSON PAYLOAD)</span>
          <span className="text-[8px] text-indigo-600 dark:text-indigo-400">PASSED DIRECTLY TO MCP CALLTOOL</span>
        </label>
        <textarea
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          spellCheck={false}
          rows={Math.min(8, Math.max(3, args.split("\n").length))}
          className="w-full rounded border border-slate-300 dark:border-indigo-800/80 bg-white dark:bg-black/70 p-2.5 text-[11px] font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-y"
          placeholder='{"param": "value"}'
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 shadow-md shadow-indigo-500/25 cursor-pointer active:scale-95 transition-all"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 fill-current" />}
          {running ? "CALLING MCP TOOL..." : "EXECUTE MCP CALL"}
        </button>

        {result && (
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-mono uppercase tracking-wider font-semibold",
              result.ok
                ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm"
                : "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 shadow-sm"
            )}
          >
            {result.ok ? "STATUS: SUCCESS (200 OK)" : "STATUS: EXECUTION ERROR"} · ⚡ {result.durationMs}ms
          </span>
        )}
      </div>

      {/* Result Display Console */}
      {result && (
        <div className="space-y-1 pt-1">
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 font-semibold flex items-center justify-between">
            <span>RESPONSE STREAM OUTPUT</span>
            <span className={result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              {result.ok ? "RAW_RESULT_OBJ" : "EXCEPTION_TRACE"}
            </span>
          </div>
          <pre className="rounded border border-slate-300 dark:border-indigo-900/60 bg-black text-slate-100 p-3 text-[10px] font-mono overflow-x-auto max-h-72 overflow-y-auto whitespace-pre shadow-inner">
            {JSON.stringify(result.output ?? result.error ?? result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ────────────── Resources Tab ────────────── */

function ResourcesTab({ server }: { server: McpServerDTO }) {
  const [resources, setResources] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [resourceContent, setResourceContent] = useState<any>(null);
  const [readingUri, setReadingUri] = useState<string | null>(null);

  const loadResources = useCallback(async () => {
    if (server.status !== "CONNECTED") return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<any[]>(`/api/mcp/servers/${server.id}/resources`);
      setResources(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list resources");
    } finally {
      setLoading(false);
    }
  }, [server.id, server.status]);

  useEffect(() => {
    if (server.status === "CONNECTED") void loadResources();
  }, [server.status, loadResources]);

  const readResource = useCallback(async (uri: string) => {
    setReadingUri(uri);
    setSelectedUri(uri);
    try {
      const data = await api<any>(`/api/mcp/servers/${server.id}/resources/read`, {
        method: "POST",
        body: JSON.stringify({ uri }),
      });
      setResourceContent(data);
    } catch (e) {
      setResourceContent({ error: e instanceof Error ? e.message : "Failed to read resource" });
    } finally {
      setReadingUri(null);
    }
  }, [server.id]);

  if (server.status !== "CONNECTED") {
    return (
      <div className="text-center py-8 space-y-2">
        <Database className="h-6 w-6 text-slate-400 mx-auto" />
        <p className="text-xs font-mono text-slate-500">Connect the server to browse resources.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-semibold flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" /> MCP RESOURCES
        </span>
        <button type="button" onClick={loadResources} disabled={loading} className="inline-flex items-center gap-1 hover:text-indigo-600 cursor-pointer">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} REFRESH
        </button>
      </div>

      {error && (
        <div className="text-[10px] font-mono text-red-600 dark:text-red-400 px-2 py-1 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30">{error}</div>
      )}

      {resources === null || (loading && resources.length === 0) ? (
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Loading resources...
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-6 space-y-1">
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">No resources exposed by this server.</p>
          <p className="text-[10px] font-mono text-slate-500">Resources are URI-addressable data exposed via MCP resources/list.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[9px] font-mono text-slate-500">{resources.length} resource(s) available — click to read content</div>
          {resources.map((res: any) => (
            <div key={res.uri} className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono font-semibold text-indigo-900 dark:text-indigo-200 truncate">{res.name ?? res.uri}</div>
                  <div className="text-[9px] font-mono text-slate-500 truncate" title={res.uri}>{res.uri}</div>
                </div>
                <div className="flex items-center gap-2">
                  {res.mimeType && (
                    <span className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-indigo-900/50 text-[8px] font-mono text-slate-500 uppercase">{res.mimeType}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => readResource(res.uri)}
                    disabled={readingUri === res.uri}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-500 bg-indigo-600 text-white text-[9px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                  >
                    {readingUri === res.uri ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />} READ
                  </button>
                </div>
              </div>
              {res.description && <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400">{res.description}</p>}

              {selectedUri === res.uri && resourceContent && (
                <div className="mt-2 rounded border border-indigo-300 dark:border-indigo-700/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 animate-fadeInUp">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-semibold mb-2">RESOURCE CONTENT</div>
                  <pre className="rounded border border-slate-200 dark:border-indigo-900/40 bg-black text-slate-100 p-3 text-[10px] font-mono overflow-x-auto max-h-72 overflow-y-auto whitespace-pre shadow-inner">
                    {typeof resourceContent === "string"
                      ? resourceContent
                      : resourceContent.text ?? JSON.stringify(resourceContent, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────── Prompts Tab ────────────── */

function PromptsTab({ server }: { server: McpServerDTO }) {
  const [prompts, setPrompts] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [promptResult, setPromptResult] = useState<any>(null);
  const [promptArgs, setPromptArgs] = useState<Record<string, string>>({});
  const [fetchingPrompt, setFetchingPrompt] = useState(false);

  const loadPrompts = useCallback(async () => {
    if (server.status !== "CONNECTED") return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<any[]>(`/api/mcp/servers/${server.id}/prompts`);
      setPrompts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list prompts");
    } finally {
      setLoading(false);
    }
  }, [server.id, server.status]);

  useEffect(() => {
    if (server.status === "CONNECTED") void loadPrompts();
  }, [server.status, loadPrompts]);

  const getPrompt = useCallback(async (name: string) => {
    setFetchingPrompt(true);
    setSelectedPrompt(name);
    try {
      const data = await api<any>(`/api/mcp/servers/${server.id}/prompts`, {
        method: "POST",
        body: JSON.stringify({ name, arguments: promptArgs }),
      });
      setPromptResult(data);
    } catch (e) {
      setPromptResult({ error: e instanceof Error ? e.message : "Failed to get prompt" });
    } finally {
      setFetchingPrompt(false);
    }
  }, [server.id, promptArgs]);

  if (server.status !== "CONNECTED") {
    return (
      <div className="text-center py-8 space-y-2">
        <BookOpen className="h-6 w-6 text-slate-400 mx-auto" />
        <p className="text-xs font-mono text-slate-500">Connect the server to browse prompt templates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-semibold flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" /> MCP PROMPT TEMPLATES
        </span>
        <button type="button" onClick={loadPrompts} disabled={loading} className="inline-flex items-center gap-1 hover:text-indigo-600 cursor-pointer">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} REFRESH
        </button>
      </div>

      {error && (
        <div className="text-[10px] font-mono text-red-600 dark:text-red-400 px-2 py-1 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30">{error}</div>
      )}

      {prompts === null || (loading && prompts.length === 0) ? (
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Loading prompts...
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-6 space-y-1">
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">No prompt templates exposed by this server.</p>
          <p className="text-[10px] font-mono text-slate-500">Prompts are curated system prompt templates exposed via MCP prompts/list.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[9px] font-mono text-slate-500">{prompts.length} prompt template(s) available</div>
          {prompts.map((prompt: any) => (
            <div key={prompt.name} className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono font-semibold text-indigo-900 dark:text-indigo-200">{prompt.name}</div>
                  {prompt.description && <div className="text-[10px] font-mono text-slate-500 truncate">{prompt.description}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => getPrompt(prompt.name)}
                  disabled={fetchingPrompt && selectedPrompt === prompt.name}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-500 bg-indigo-600 text-white text-[9px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                >
                  {fetchingPrompt && selectedPrompt === prompt.name ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />} GET
                </button>
              </div>

              {/* Prompt arguments */}
              {prompt.arguments && prompt.arguments.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">ARGUMENTS</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {prompt.arguments.map((arg: any) => (
                      <div key={arg.name} className="flex items-center gap-2">
                        <label className="text-[9px] font-mono text-slate-600 dark:text-slate-400 shrink-0">
                          {arg.name}{arg.required && <span className="text-red-500 ml-0.5">*</span>}:
                        </label>
                        <input
                          type="text"
                          value={promptArgs[arg.name] ?? ""}
                          onChange={(e) => setPromptArgs((prev) => ({ ...prev, [arg.name]: e.target.value }))}
                          placeholder={arg.description ?? arg.name}
                          className="flex-1 rounded border border-slate-300 dark:border-indigo-800/60 bg-white dark:bg-black/50 px-2 py-0.5 text-[9px] font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt result */}
              {selectedPrompt === prompt.name && promptResult && (
                <div className="mt-2 rounded border border-indigo-300 dark:border-indigo-700/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 animate-fadeInUp">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-semibold mb-2">PROMPT RESULT</div>
                  {promptResult.messages ? (
                    <div className="space-y-2">
                      {promptResult.messages.map((msg: any, i: number) => (
                        <div key={i} className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-2">
                          <span className={clsx(
                            "text-[8px] font-mono uppercase font-bold px-1.5 py-0.5 rounded mr-2",
                            msg.role === "user"
                              ? "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300"
                              : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                          )}>{msg.role}</span>
                          <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300">
                            {msg.content?.text ?? JSON.stringify(msg.content)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="rounded border border-slate-200 dark:border-indigo-900/40 bg-black text-slate-100 p-3 text-[10px] font-mono overflow-x-auto max-h-60 overflow-y-auto whitespace-pre shadow-inner">
                      {JSON.stringify(promptResult, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────── Sampling Tab ────────────── */

function SamplingTab({ server }: { server: McpServerDTO }) {
  const [messages, setMessages] = useState(
    JSON.stringify(
      [{ role: "user", content: { type: "text", text: "Hello, can you help me?" } }],
      null,
      2
    )
  );
  const [systemPrompt, setSystemPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [temperature, setTemperature] = useState("0.7");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (server.status !== "CONNECTED") {
    return (
      <div className="text-center py-8 space-y-2">
        <Brain className="h-6 w-6 text-slate-400 mx-auto" />
        <p className="text-xs font-mono text-slate-500">Connect the server to test sampling.</p>
      </div>
    );
  }

  const handleSample = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      let parsedMessages: any[];
      try {
        parsedMessages = JSON.parse(messages);
      } catch {
        setError("Messages must be valid JSON array");
        return;
      }
      const res = await api<any>(`/api/mcp/servers/${server.id}/sampling`, {
        method: "POST",
        body: JSON.stringify({
          messages: parsedMessages,
          systemPrompt: systemPrompt || undefined,
          maxTokens: parseInt(maxTokens) || 4096,
          temperature: parseFloat(temperature) || 0.7,
        }),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sampling request failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-semibold flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5" /> MCP SAMPLING (sampling/createMessage)
      </div>

      <p className="text-[10px] font-mono text-slate-500">
        Send LLM sampling requests from connected MCP servers. Agent Studio acts as a sampling client,
        allowing nested agentic behavior where tools call Studio models without needing their own API keys.
      </p>

      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 font-semibold">MESSAGES (JSON ARRAY)</label>
          <textarea
            value={messages}
            onChange={(e) => setMessages(e.target.value)}
            spellCheck={false}
            rows={5}
            className="w-full rounded border border-slate-300 dark:border-indigo-800/80 bg-white dark:bg-black/70 p-2.5 text-[10px] font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-y"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 font-semibold">SYSTEM PROMPT</label>
            <input
              type="text"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Optional system prompt"
              className="w-full rounded border border-slate-300 dark:border-indigo-800/60 bg-white dark:bg-black/50 px-2 py-1 text-[10px] font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 font-semibold">MAX TOKENS</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              className="w-full rounded border border-slate-300 dark:border-indigo-800/60 bg-white dark:bg-black/50 px-2 py-1 text-[10px] font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 font-semibold">TEMPERATURE</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full rounded border border-slate-300 dark:border-indigo-800/60 bg-white dark:bg-black/50 px-2 py-1 text-[10px] font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSample}
          disabled={running}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 shadow-md shadow-indigo-500/25 cursor-pointer active:scale-95 transition-all"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
          {running ? "SAMPLING..." : "SEND SAMPLING REQUEST"}
        </button>
      </div>

      {error && (
        <div className="text-[10px] font-mono text-red-600 dark:text-red-400 px-2 py-1 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30">{error}</div>
      )}

      {result && (
        <div className="rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 animate-fadeInUp">
          <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-semibold mb-2">SAMPLING RESULT</div>
          <div className="space-y-1">
            <div className="text-[9px] font-mono text-slate-500">Model: <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{result.model}</span></div>
            {result.stopReason && <div className="text-[9px] font-mono text-slate-500">Stop: <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{result.stopReason}</span></div>}
          </div>
          <pre className="mt-2 rounded border border-slate-200 dark:border-indigo-900/40 bg-black text-slate-100 p-3 text-[10px] font-mono overflow-x-auto max-h-60 overflow-y-auto whitespace-pre shadow-inner">
            {result.content?.text ?? JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ────────────── Progress Tab ────────────── */

function ProgressTab({ server }: { server: McpServerDTO }) {
  const [events, setEvents] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [listening, setListening] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startListening = useCallback(() => {
    if (server.status !== "CONNECTED") return;
    setListening(true);
    setEvents([]);

    const es = new EventSource(`/api/mcp/servers/${server.id}/progress`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          setConnected(true);
        } else if (data.type !== "heartbeat") {
          setEvents((prev) => [data, ...prev].slice(0, 100));
        }
      } catch {
        // Ignore parse errors from heartbeats
      }
    };

    es.onerror = () => {
      setConnected(false);
      setListening(false);
      es.close();
      eventSourceRef.current = null;
    };
  }, [server.id, server.status]);

  const stopListening = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setListening(false);
    setConnected(false);
  }, []);

  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
  }, []);

  if (server.status !== "CONNECTED") {
    return (
      <div className="text-center py-8 space-y-2">
        <Activity className="h-6 w-6 text-slate-400 mx-auto" />
        <p className="text-xs font-mono text-slate-500">Connect the server to view progress events.</p>
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    started: "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300",
    progress: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300",
    completed: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300",
    failed: "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300",
  };

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-semibold flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> PROGRESS NOTIFICATIONS (SSE)
        </span>
        <div className="flex items-center gap-2">
          <span className={clsx(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-mono",
            connected
              ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
              : "border-slate-300 dark:border-slate-700 text-slate-500"
          )}>
            <span className={clsx("h-1.5 w-1.5 rounded-full", connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
            {connected ? "STREAM ACTIVE" : "DISCONNECTED"}
          </span>
          {listening ? (
            <button type="button" onClick={stopListening} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 text-[9px] font-mono font-semibold uppercase cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30">
              <X className="h-2.5 w-2.5" /> STOP
            </button>
          ) : (
            <button type="button" onClick={startListening} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-500 bg-indigo-600 text-white text-[9px] font-mono font-semibold uppercase cursor-pointer hover:bg-indigo-500">
              <Activity className="h-2.5 w-2.5" /> START LISTENING
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] font-mono text-slate-500">
        Real-time progress events streamed via Server-Sent Events during MCP tool/resource/prompt calls.
        Start listening, then execute a tool from the Tools tab to see progress events here.
      </p>

      <div className="text-[9px] font-mono text-slate-500">
        {events.length} event(s) received
      </div>

      {events.length === 0 ? (
        <div className="text-center py-6 space-y-1">
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">No progress events yet.</p>
          <p className="text-[10px] font-mono text-slate-500">Click START LISTENING, then run a tool to see progress events stream in real-time.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {events.map((event, i) => (
            <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60">
              <span className={clsx(
                "px-1.5 py-0.5 rounded border text-[8px] font-mono font-bold uppercase shrink-0",
                typeColors[event.type] ?? typeColors.started
              )}>{event.type}</span>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 font-semibold">{event.operation}</span>
                {event.detail && <span className="text-[10px] font-mono text-slate-500 ml-1">// {event.detail}</span>}
                {event.message && <div className="text-[9px] font-mono text-slate-500 mt-0.5">{event.message}</div>}
                {event.error && <div className="text-[9px] font-mono text-red-500 mt-0.5">{event.error}</div>}
                {event.progress !== undefined && (
                  <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${event.progress}%` }} />
                  </div>
                )}
              </div>
              <span className="text-[8px] font-mono text-slate-400 shrink-0">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────── Connect Modal ────────────── */

function ConnectModal({
  initialPreset,
  presets,
  onClose,
  onCreated,
}: {
  initialPreset: McpPreset | null;
  presets: McpPreset[];
  onClose: () => void;
  onCreated: (server: McpServerDTO) => void;
}) {
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<"SSE" | "STDIO">("SSE");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [command, setCommand] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<McpPreset | null>(initialPreset);

  const applyPreset = (preset: McpPreset) => {
    setActivePreset(preset);
    setName(preset.name);
    setTransport(preset.transport);
    setEndpointUrl(preset.endpointUrl ?? "");
    setCommand(preset.command ?? "");
    // Auth placeholders are never filled automatically — the user supplies the
    // real token (the preset header template would leak a literal ${TOKEN}).
    setAuthToken("");
  };

  // 1-click presets opened from the hub pre-fill the form on mount.
  useEffect(() => {
    if (initialPreset) applyPreset(initialPreset);
     
  }, [initialPreset]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const headers: Record<string, string> | undefined = authToken.trim()
        ? { Authorization: authToken.trim().startsWith("Bearer ") ? authToken.trim() : `Bearer ${authToken.trim()}` }
        : undefined;
      const body =
        transport === "SSE"
          ? { name: name.trim(), transport, endpointUrl: endpointUrl.trim(), headers }
          : { name: name.trim(), transport, command: command.trim(), headers };
      const server = await api<McpServerDTO>("/api/mcp/servers", { method: "POST", body: JSON.stringify(body) });
      onCreated(server);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded border border-slate-200 dark:border-indigo-800/60 bg-white dark:bg-[#0a0a0a] shadow-2xl font-mono max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
            <Plug className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Connect MCP Server
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-red-500 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Presets */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-semibold flex items-center gap-1">
              <Zap className="h-3 w-3" /> 1-CLICK PRESETS
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="text-left px-2 py-1.5 rounded border border-slate-200 dark:border-indigo-900/50 text-[9px] font-mono font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-400 transition-all cursor-pointer truncate"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">Server Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GitHub MCP"
              className="w-full rounded border border-slate-300 dark:border-indigo-800/60 bg-white dark:bg-black/50 p-2 text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:border-indigo-400 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">Transport</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["SSE", "STDIO"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTransport(t)}
                  className={clsx(
                    "px-3 py-2 rounded border text-[10px] font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer",
                    transport === t
                      ? "border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                      : "border-slate-300 dark:border-indigo-900/50 text-slate-600 dark:text-slate-400 hover:border-indigo-400"
                  )}
                >
                  {t === "SSE" ? "SSE / HTTP" : "STDIO"}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-mono text-slate-500">
              {transport === "SSE"
                ? "Remote server — Streamable HTTP with legacy SSE fallback."
                : "Local process — e.g. npx -y @modelcontextprotocol/server-postgres <DATABASE_URL>"}
            </p>
          </div>

          {transport === "SSE" ? (
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">Endpoint URL</label>
              <input
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://mcp.example.com/sse"
                className="w-full rounded border border-slate-300 dark:border-indigo-800/60 bg-white dark:bg-black/50 p-2 text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:border-indigo-400 outline-none"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">Command</label>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="npx -y @modelcontextprotocol/server-filesystem ./data"
                className="w-full rounded border border-slate-300 dark:border-indigo-800/60 bg-white dark:bg-black/50 p-2 text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:border-indigo-400 outline-none"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1">
                <KeyRound className="h-3 w-3 text-amber-500" />
                Auth Token {activePreset?.requiresAuthToken ? "(required for this service)" : "(optional)"}
              </span>
              {activePreset?.requiresAuthToken && (
                <span className="text-[8px] text-amber-600 dark:text-amber-400 font-semibold uppercase">Auth Required</span>
              )}
            </label>
            <input
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              type="password"
              placeholder={
                activePreset?.id === "github"
                  ? "ghp_xxxxxxxxxxxxxxxxxxxx (GitHub Personal Access Token)"
                  : activePreset?.id === "brave"
                  ? "BSA_xxxxxxxxxxxxxxxxxxxx (Brave Search API Key)"
                  : "Bearer token sent as an Authorization header"
              }
              className="w-full rounded border border-slate-300 dark:border-indigo-800/60 bg-white dark:bg-black/50 p-2 text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:border-indigo-400 outline-none"
            />
          </div>

          {error && (
            <p className="text-[10px] font-mono text-red-700 dark:text-red-400 font-semibold">⚠ {error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded border border-slate-300 dark:border-indigo-900/50 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:border-indigo-400 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !name.trim() || (transport === "SSE" ? !endpointUrl.trim() : !command.trim())}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
              {submitting ? "Connecting…" : "Connect & Discover"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteMcpServerModal({
  server,
  isPending,
  onClose,
  onConfirm,
}: {
  server: McpServerDTO;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded border border-red-300/60 dark:border-red-500/40 bg-white dark:bg-[#0a0a0a] p-5 font-mono shadow-2xl space-y-4 animate-fadeInUp text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm MCP Server Deletion"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-red-200 dark:border-red-950/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded border border-red-400/50 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <Trash2 className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                DELETE MCP SERVER
              </h3>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                [SYS::SEVER_MCP_INTEGRATION]
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Warning Explanation */}
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Are you sure you want to delete this Model Context Protocol server configuration?
          All discovered tools will immediately be unmounted from the LangGraph execution runtime.
        </p>

        {/* Server Details Spec Box */}
        <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/80 dark:bg-black/60 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-slate-500 font-semibold">SERVER NAME:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-indigo-500" />
              {server.name}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-slate-500 font-semibold">TRANSPORT:</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-300 dark:border-indigo-800 bg-white dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 uppercase">
              {server.transport} ({server.transport === "SSE" ? "REMOTE" : "LOCAL"})
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[10px] uppercase text-slate-500 font-semibold">
              {server.transport === "SSE" ? "ENDPOINT:" : "COMMAND:"}
            </span>
            <span className="font-mono text-[10px] text-indigo-700 dark:text-indigo-400 max-w-[260px] truncate">
              {server.transport === "SSE" ? server.endpointUrl : server.command}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-indigo-950/60">
            <span className="text-[10px] uppercase text-slate-500 font-semibold">CACHED TOOLS:</span>
            <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
              <Braces className="h-3 w-3" />
              {server.cachedTools.length} TOOLS WILL BE UNMOUNTED
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-indigo-950/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded border border-slate-300 dark:border-indigo-900/50 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40 cursor-pointer disabled:opacity-50 transition-all"
          >
            [ CANCEL ]
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-red-500 bg-red-600 text-white text-xs font-mono font-semibold uppercase tracking-wider hover:bg-red-500 shadow-md shadow-red-500/30 disabled:opacity-50 cursor-pointer transition-all active:scale-95"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {isPending ? "UNMOUNTING..." : "[ DELETE SERVER ]"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportMcpModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [jsonText, setJsonText] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonText(String(event.target?.result ?? ""));
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!jsonText.trim()) {
      setError("Please provide a valid JSON bundle");
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new Error("Invalid JSON format");
      }

      const res = await api<{ importedCount: number; errorCount: number; errors?: { name: string; error: string }[] }>(
        "/api/mcp/servers/import",
        {
          method: "POST",
          body: JSON.stringify(parsed),
        }
      );

      if (res.errorCount > 0 && res.importedCount === 0) {
        throw new Error(res.errors?.[0]?.error ?? "Import failed");
      }

      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-[#0a0a0a] p-5 font-mono shadow-2xl space-y-4 animate-fadeInUp text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Import MCP Server Configurations"
      >
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-indigo-950/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded border border-indigo-400/50 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                IMPORT MCP SERVERS
              </h3>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                [PORTABLE_BUNDLE::JSON_IMPORT]
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              PASTE JSON OR UPLOAD .JSON BUNDLE
            </label>
            <label className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
              <Upload className="h-3 w-3" />
              <span>CHOOSE FILE</span>
              <input type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setError(null);
            }}
            placeholder={`{\n  "version": "1.0",\n  "servers": [\n    {\n      "name": "Playwright MCP",\n      "transport": "STDIO",\n      "command": "npx -y @playwright/mcp@latest"\n    }\n  ]\n}`}
            rows={8}
            className="w-full rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50/50 dark:bg-black/60 p-3 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-indigo-950/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded border border-slate-300 dark:border-indigo-900/50 text-xs font-mono font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40 cursor-pointer disabled:opacity-50 transition-all"
          >
            [ CANCEL ]
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={isPending || !jsonText.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-indigo-500 bg-indigo-600 text-white text-xs font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 shadow-md shadow-indigo-500/30 disabled:opacity-50 cursor-pointer transition-all active:scale-95"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {isPending ? "IMPORTING..." : "[ IMPORT SERVERS ]"}
          </button>
        </div>
      </div>
    </div>
  );
}


