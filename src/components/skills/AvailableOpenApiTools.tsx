"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Loader2, CircleAlert, Check, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";
import { OpenApiIntegrationDTO } from "@/types/openapi";
import { openApiToolRegistryName } from "@/modules/openapi/dynamicTool";

interface AvailableOpenApiToolsProps {
  /** Currently selected allowedTools (registry names). */
  selected: string[];
  onAdd: (registryName: string) => void;
}

/**
 * OpenAPI tool allow-listing picker for the skill and workflow editor.
 * Loads the user's connected OpenAPI integrations and lets them 1-click add
 * active endpoints to `allowedTools` using their runtime registry name (`openapi_<id>_<opId>`).
 */
export function AvailableOpenApiTools({ selected, onAdd }: AvailableOpenApiToolsProps) {
  const [integrations, setIntegrations] = useState<OpenApiIntegrationDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/openapi/integrations")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success === true) setIntegrations(json.data ?? []);
        else setError(json?.error ?? "Failed to load OpenAPI integrations");
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load OpenAPI integrations");
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

  if (integrations === null) {
    return (
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-indigo-950/60 text-[10px] font-mono text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin text-indigo-500" /> LOADING OPENAPI TOOLS…
      </div>
    );
  }

  const activeIntegrations = integrations.filter(
    (i) => i.status === "CONNECTED" && i.endpoints && i.endpoints.length > 0
  );

  if (activeIntegrations.length === 0) {
    return (
      <div className="pt-2 border-t border-slate-200 dark:border-indigo-950/60 space-y-1">
        <div className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-500 font-medium">
          OPENAPI & REST TOOLS
        </div>
        <p className="text-[10px] font-mono text-slate-500">
          No OpenAPI integrations connected yet. Enable presets in the{" "}
          <Link
            href="/dashboard/tools?tab=openapi"
            className="text-indigo-600 dark:text-indigo-400 underline decoration-dotted hover:text-indigo-500"
          >
            OpenAPI Hub
          </Link>{" "}
          to pick them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-indigo-950/60">
      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-500 font-medium flex items-center gap-1">
        <Globe className="h-3 w-3 text-cyan-600 dark:text-cyan-400" /> OPENAPI REST TOOLS
      </div>
      {activeIntegrations.map((integration) => {
        const validEndpoints = integration.endpoints.filter((e) => e.enabled !== false);
        if (validEndpoints.length === 0) return null;

        return (
          <div key={integration.id} className="space-y-1">
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-800 dark:text-cyan-400 uppercase tracking-wider font-semibold">
              <Globe className="h-3 w-3" />
              {integration.name}
              <span className="text-slate-500 normal-case tracking-normal font-medium">
                · {validEndpoints.length} endpoints
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {validEndpoints.map((endpoint) => {
                const registryName = openApiToolRegistryName(integration.id, endpoint.operationId);
                const isSelected = selected.includes(registryName);
                const isWrite = endpoint.isWrite || endpoint.method !== "GET";

                return (
                  <button
                    key={registryName}
                    type="button"
                    onClick={() => onAdd(registryName)}
                    disabled={isSelected}
                    title={endpoint.description || `${endpoint.method} ${endpoint.path}`}
                    className={clsx(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono transition-all cursor-pointer font-medium max-w-full",
                      isSelected
                        ? "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 opacity-80"
                        : "border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-300 hover:border-cyan-400"
                    )}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />}
                    <span className="font-bold text-[9px] uppercase px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {endpoint.method}
                    </span>
                    <span className="truncate">{endpoint.summary || endpoint.operationId}</span>
                    {isWrite && (
                      <span className="inline-flex items-center gap-0.5 text-[8px] uppercase tracking-wider font-semibold px-1 rounded bg-amber-200/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                        <ShieldCheck className="h-2 w-2" /> HITL
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
