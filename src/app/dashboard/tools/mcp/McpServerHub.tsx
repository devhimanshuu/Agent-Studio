"use client";

import React, { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { clsx } from "clsx";
import {
  McpHealth,
  McpPreset,
  McpServerDTO,
  McpToolDefinition,
  McpToolTestResult,
} from "@/types/mcp";
import { MCP_PRESETS } from "@/modules/mcp/presets";

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

      {/* Presets strip */}
      <div className="space-y-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50/50 dark:bg-[#0a0a0a]/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-bold flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
            1-CLICK ECOSYSTEM PRESETS ({presets.length} READY TO MOUNT)
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

      {/* Server list */}
      <div className="space-y-3 pt-2">
        <div className="text-[11px] font-mono uppercase tracking-widest text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Server className="h-4 w-4 text-indigo-500" />
            CONFIGURED MCP SERVERS
          </span>
          <span className="text-[10px] font-normal text-slate-500">
            DISCOVERED TOOLS ARE AUTO-REGISTERED IN WORKFLOW RUNTIMES
          </span>
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
          <div className="space-y-3">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                health={health[server.id]}
                busy={busy === server.id}
                expanded={expanded === server.id}
                onToggle={() => setExpanded((prev) => (prev === server.id ? null : server.id))}
                onConnect={() => refresh(server.id)}
                onDisconnect={() => disconnect(server.id)}
                onRediscover={() => rediscover(server.id)}
                onDelete={() => setDeleteTarget(server)}
                onHealth={() => probe(server.id)}
              />
            ))}
          </div>
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
        <span className="text-[11px] font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">{preset.name}</span>
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
  onToggle: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRediscover: () => void;
  onDelete: () => void;
  onHealth: () => void;
}) {
  const { server, health, busy, expanded } = props;
  const theme = statusTheme[server.status] ?? statusTheme.DISCONNECTED;
  const isConnected = server.status === "CONNECTED";

  return (
    <div className="rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/60 shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={clsx("p-2 rounded border shadow-sm", theme.chip)}>
              <Server className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono truncate">{server.name}</h3>
              <p className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400/80 truncate font-medium">
                {server.transport === "SSE" ? server.endpointUrl : server.command}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono">
            <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded border uppercase tracking-wider", theme.chip)}>
              <span className={clsx("h-1.5 w-1.5 rounded-full animate-pulse", theme.dot)} />
              {server.status}
            </span>
            <span className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a]/60 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
              {server.transport}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a]/60 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
              <Braces className="h-2.5 w-2.5" /> {server.cachedTools.length} TOOLS
            </span>
          </div>
        </div>

        {server.lastError && server.status === "ERROR" && (
          <p className="text-[10px] font-mono text-red-700 dark:text-red-400 font-semibold break-all">⚠ {server.lastError}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-indigo-950/60 pt-2.5">
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600 dark:text-slate-400 font-medium">
            {health ? (
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border uppercase tracking-wider font-semibold",
                  health.status === "healthy"
                    ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
                    : health.status === "degraded"
                      ? "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
                      : "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300"
                )}
              >
                <span
                  className={clsx(
                    "h-1.5 w-1.5 rounded-full",
                    health.status === "healthy" ? "bg-emerald-500" : health.status === "degraded" ? "bg-amber-500" : "bg-red-500"
                  )}
                />
                {health.status} · {health.latencyMs}ms
              </span>
            ) : (
              <button type="button" onClick={props.onHealth} className="inline-flex items-center gap-1 hover:text-indigo-600 cursor-pointer">
                <Activity className="h-3 w-3" /> PROBE
              </button>
            )}
            <span className="text-slate-500">UPDATED {formatDate(server.updatedAt)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {isConnected ? (
              <ActionButton icon={Unplug} label="Disconnect" onClick={props.onDisconnect} disabled={busy} tone="neutral" />
            ) : (
              <ActionButton icon={PlugZap} label="Connect" onClick={props.onConnect} disabled={busy} tone="primary" />
            )}
            <ActionButton icon={RefreshCw} label="Rediscover" onClick={props.onRediscover} disabled={busy} tone="neutral" />
            <ActionButton icon={Trash2} label="Delete" onClick={props.onDelete} disabled={busy} tone="danger" />
            <button
              type="button"
              onClick={props.onToggle}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-indigo-900/50 text-[9px] font-mono uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 hover:border-indigo-400 transition-all cursor-pointer"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Inspect
            </button>
          </div>
        </div>
      </div>

      {expanded && <ToolInspector server={server} />}
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

function ToolInspector({ server }: { server: McpServerDTO }) {
  const [activeTestTool, setActiveTestTool] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState<string | null>(null);

  return (
    <div className="border-t border-slate-200 dark:border-indigo-950/60 bg-slate-50/60 dark:bg-black/30 p-4 space-y-3">
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
                    {isSchemaOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
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
                  <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
                    {tool.description}
                  </p>
                )}

                {isSchemaOpen && (
                  <pre className="rounded border border-slate-200 dark:border-indigo-900/40 bg-black/40 dark:bg-black/60 p-2.5 text-[9px] text-slate-700 dark:text-slate-300 font-mono overflow-x-auto max-h-56 overflow-y-auto whitespace-pre">
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                )}

                {/* Inline Test Console directly below this tool */}
                {isTesting && (
                  <ToolTestConsole
                    server={server}
                    tool={tool}
                    onClose={() => setActiveTestTool(null)}
                  />
                )}
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

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
