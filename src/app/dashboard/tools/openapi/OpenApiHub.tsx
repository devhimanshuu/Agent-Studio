"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Globe,
  Plus,
  Trash2,
  Play,
  Layers,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Loader2,
  CircleAlert,
  Sparkles,
  Download,
  CheckCircle2,
  CloudSun,
  BadgeDollarSign,
  Globe2,
  BookOpen,
  Compass,
  ShoppingBag,
  Github,
  Zap,
  X,
  Check,
} from "lucide-react";
import { clsx } from "clsx";
import { OpenApiEndpointDefinition, OpenApiIntegrationDTO } from "@/types/openapi";
import { OPENAPI_PRESETS, OpenApiPreset } from "@/modules/openapi/presets";
import { OpenApiImportModal } from "./OpenApiImportModal";
import { OpenApiEndpointTesterModal } from "./OpenApiEndpointTesterModal";
import { OpenApiDirectoryBrowser } from "./OpenApiDirectoryBrowser";

const pad = (n: number) => String(n).padStart(2, "0");

const PRESET_ICONS: Record<string, typeof Globe> = {
  BadgeDollarSign,
  CloudSun,
  Globe2,
  BookOpen,
  Compass,
  ShoppingBag,
  Github,
};

export function OpenApiHub() {
  const [hubMode, setHubMode] = useState<"CONNECTED" | "PRESETS" | "DIRECTORY">("CONNECTED");
  const [integrations, setIntegrations] = useState<OpenApiIntegrationDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [installingPresetId, setInstallingPresetId] = useState<string | null>(null);

  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importSpecUrl, setImportSpecUrl] = useState<string | undefined>(undefined);
  const [testingEndpoint, setTestingEndpoint] = useState<{
    endpoint: OpenApiEndpointDefinition;
    integration: OpenApiIntegrationDTO;
  } | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/openapi/integrations");
      const json = await res.json();
      if (!res.ok || json.success === false) {
        setError(json.error || "Failed to load integrations");
      } else {
        setIntegrations(json.data);
        setExpandedId((prev) => prev ?? (json.data.length > 0 ? json.data[0].id : null));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleInstallPreset = async (preset: OpenApiPreset) => {
    setInstallingPresetId(preset.id);
    try {
      const res = await fetch("/api/openapi/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preset.name,
          description: preset.description,
          baseUrl: preset.baseUrl,
          authType: "NONE",
          endpoints: preset.endpoints,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        await fetchIntegrations();
        setSuccessMessage(`Installed "${preset.name}" into tool matrix successfully.`);
        setHubMode("CONNECTED");
        setExpandedId(json.data.id);
      } else {
        setError(json.error || "Failed to install preset");
      }
    } catch {
      setError("Error installing preset pack");
    } finally {
      setInstallingPresetId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" and unmount all its generated tools?`)) return;

    try {
      const res = await fetch(`/api/openapi/integrations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setIntegrations((prev) => (prev ? prev.filter((i) => i.id !== id) : []));
        setSuccessMessage(`Deleted integration "${name}".`);
      }
    } catch {
      setError("Failed to delete integration");
    }
  };

  const totalTools =
    integrations?.reduce(
      (sum, i) => sum + i.endpoints.filter((ep) => ep.enabled !== false).length,
      0
    ) ?? 0;

  const hitlTools =
    integrations?.reduce(
      (sum, i) =>
        sum + i.endpoints.filter((ep) => ep.enabled !== false && ep.requiresApproval).length,
      0
    ) ?? 0;

  const isPresetInstalled = (presetName: string) => {
    return integrations?.some((i) => i.name === presetName);
  };

  return (
    <div className="space-y-6 w-full font-mono">
      {/* Top Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-700 dark:text-slate-400 px-3 py-2 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 shadow-sm font-semibold">
          <Globe className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          {pad(integrations?.length ?? 0)} APIS · {pad(totalTools)} ACTIVE TOOLS · {pad(hitlTools)} HITL GATED
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setImportSpecUrl(undefined);
              setIsImportOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 shadow-sm shadow-indigo-500/30 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Import Custom Spec
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-[11px] font-mono font-semibold">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" /> {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto cursor-pointer hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono font-semibold">
          <Check className="h-3.5 w-3.5 shrink-0" /> {successMessage}
          <button type="button" onClick={() => setSuccessMessage(null)} className="ml-auto cursor-pointer hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="space-y-4 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50/50 dark:bg-[#0a0a0a]/40 p-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950 pb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHubMode("CONNECTED")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
                hubMode === "CONNECTED"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              MOUNTED REST APIS ({integrations?.length ?? 0})
            </button>

            <button
              type="button"
              onClick={() => setHubMode("PRESETS")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
                hubMode === "PRESETS"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Zap className={clsx("h-3.5 w-3.5", hubMode === "PRESETS" ? "fill-amber-400 text-amber-300" : "text-amber-500")} />
              1-CLICK FREE TOOL PACKS ({OPENAPI_PRESETS.length})
            </button>

            <button
              type="button"
              onClick={() => setHubMode("DIRECTORY")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer relative",
                hubMode === "DIRECTORY"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Globe className="h-3.5 w-3.5 text-indigo-400" />
              PUBLIC DIRECTORY (APIS.GURU)
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[8px] bg-amber-400 text-black font-bold uppercase">
                2.5K+
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: MOUNTED REST APIS */}
        {hubMode === "CONNECTED" && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-indigo-500" /> LOADING MOUNTED REST APIS...
              </div>
            ) : !integrations || integrations.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-300 dark:border-indigo-900/60 rounded-md space-y-3 bg-white/40 dark:bg-[#08080c]/60">
                <div className="w-10 h-10 rounded border border-indigo-300 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto bg-indigo-50 dark:bg-indigo-950/40">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    NO CUSTOM REST APIS MOUNTED
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Install 1-click free tool packs (Forex, Weather, Wikipedia) or import any Swagger/OpenAPI URL to mount custom tools into your execution matrix.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setHubMode("PRESETS")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[10px] font-semibold uppercase tracking-wider hover:bg-amber-100 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 fill-current" /> Browse Free Tool Packs
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportSpecUrl(undefined);
                      setIsImportOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-semibold uppercase tracking-wider hover:bg-indigo-500 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Import Custom Spec
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {integrations.map((integration) => {
                  const isExpanded = expandedId === integration.id;
                  const activeEndpoints = integration.endpoints.filter((e) => e.enabled !== false);

                  return (
                    <div
                      key={integration.id}
                      className="rounded-md border border-slate-200 dark:border-indigo-950/60 bg-white dark:bg-[#08080c] overflow-hidden shadow-xs hover:border-indigo-500/60 transition-all"
                    >
                      {/* Card Header */}
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : integration.id)}
                        className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-indigo-950/20 transition-colors border-b border-transparent data-[open=true]:border-slate-100 dark:data-[open=true]:border-indigo-950/40"
                        data-open={isExpanded}
                      >
                        <div className="flex items-center gap-3">
                          <span className="p-0.5 text-slate-400 hover:text-indigo-400">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                                {integration.name}
                              </h3>
                              <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300 font-semibold">
                                {integration.authType}
                              </span>
                              <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-semibold">
                                {integration.status}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate max-w-xl">
                              {integration.baseUrl}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-auto">
                          <span className="text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-indigo-950/20">
                            {pad(activeEndpoints.length)} TOOLS
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(integration.id, integration.name);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                            title="Delete and unmount this integration"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Endpoints Grid */}
                      {isExpanded && (
                        <div className="p-3.5 bg-slate-50/40 dark:bg-indigo-950/10 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {integration.endpoints.map((ep) => (
                              <div
                                key={ep.id}
                                className="p-2.5 rounded border border-slate-200 dark:border-indigo-950/80 bg-white dark:bg-[#0a0a0e] flex items-center justify-between gap-2 hover:border-indigo-500/60 transition-all"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span
                                    className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${getMethodBadge(
                                      ep.method
                                    )}`}
                                  >
                                    {ep.method}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                                      {ep.summary || ep.operationId}
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-500 truncate">{ep.path}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {ep.requiresApproval && (
                                    <span
                                      title="Human-in-the-Loop Review Gated"
                                      className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/40 uppercase"
                                    >
                                      <ShieldAlert className="w-2.5 h-2.5" /> HITL
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setTestingEndpoint({ endpoint: ep, integration })}
                                    className="px-2 py-1 text-[10px] font-mono font-semibold uppercase text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800/80 hover:bg-indigo-100 rounded flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current" /> Test
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FREE TOOL PACKS PRESETS */}
        {hubMode === "PRESETS" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {OPENAPI_PRESETS.map((preset) => {
              const IconComp = PRESET_ICONS[preset.icon] || Globe;
              const installed = isPresetInstalled(preset.name);
              const isInstalling = installingPresetId === preset.id;

              return (
                <div
                  key={preset.id}
                  className="rounded-md border border-slate-200 dark:border-indigo-950/60 bg-white dark:bg-[#08080c] p-4 flex flex-col justify-between gap-3 hover:border-indigo-500/60 transition-all group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded border border-indigo-300 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className="px-2 py-0.5 text-[9px] font-mono font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-300 dark:border-emerald-500/40 uppercase">
                        {preset.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-400 transition-colors uppercase tracking-wide">
                        {preset.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider mb-1">
                        INCLUDED TOOLS ({preset.endpoints.length}):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {preset.endpoints.map((ep) => (
                          <span
                            key={ep.id}
                            className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-indigo-950"
                          >
                            {ep.method} {ep.path}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]">
                      {preset.baseUrl}
                    </span>

                    {installed ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded border border-emerald-300 dark:border-emerald-500/40 uppercase">
                        <CheckCircle2 className="w-3 h-3" /> Installed
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInstallPreset(preset)}
                        disabled={isInstalling}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isInstalling ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Adding...
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3" /> 1-Click Mount
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: GLOBAL DIRECTORY (APIS.GURU) */}
        {hubMode === "DIRECTORY" && (
          <OpenApiDirectoryBrowser
            onSelectSpecUrl={(url) => {
              setImportSpecUrl(url);
              setIsImportOpen(true);
            }}
          />
        )}
      </div>

      {/* Modals */}
      <OpenApiImportModal
        isOpen={isImportOpen}
        initialSpecUrl={importSpecUrl}
        onClose={() => {
          setIsImportOpen(false);
          setImportSpecUrl(undefined);
        }}
        onSuccess={fetchIntegrations}
      />

      {testingEndpoint && (
        <OpenApiEndpointTesterModal
          endpoint={testingEndpoint.endpoint}
          integrationId={testingEndpoint.integration.id}
          baseUrl={testingEndpoint.integration.baseUrl}
          authType={testingEndpoint.integration.authType}
          authConfig={testingEndpoint.integration.authConfig}
          onClose={() => setTestingEndpoint(null)}
        />
      )}
    </div>
  );
}

function getMethodBadge(method: string) {
  switch (method) {
    case "GET":
      return "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300";
    case "POST":
      return "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300";
    case "PUT":
    case "PATCH":
      return "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300";
    case "DELETE":
      return "border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300";
    default:
      return "border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300";
  }
}
