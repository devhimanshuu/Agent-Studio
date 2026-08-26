"use client";

import React, { useState } from "react";
import {
  X,
  Play,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  OpenApiAuthConfig,
  OpenApiAuthType,
  OpenApiEndpointDefinition,
  OpenApiToolTestResult,
} from "@/types/openapi";

interface OpenApiEndpointTesterModalProps {
  endpoint: OpenApiEndpointDefinition;
  integrationId?: string;
  baseUrl: string;
  authType: OpenApiAuthType;
  authConfig?: OpenApiAuthConfig | null;
  onClose: () => void;
}

export function OpenApiEndpointTesterModal({
  endpoint,
  integrationId,
  baseUrl,
  authType,
  authConfig,
  onClose,
}: OpenApiEndpointTesterModalProps) {
  // Initialize parameter values
  const [paramValues, setParamValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of endpoint.parameters) {
      initial[p.name] = "";
    }
    return initial;
  });

  const [bodyValue, setBodyValue] = useState<string>(() => {
    if (endpoint.requestBody?.schema) {
      return JSON.stringify(generateSampleJsonFromSchema(endpoint.requestBody.schema), null, 2);
    }
    return "";
  });

  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<OpenApiToolTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunTest = async () => {
    setIsRunning(true);
    setError(null);
    setTestResult(null);

    const args: Record<string, unknown> = {};

    // Collect parameter values
    for (const [key, val] of Object.entries(paramValues)) {
      if (val.trim()) {
        const paramDef = endpoint.parameters.find((p) => p.name === key);
        const schemaType = (paramDef?.schema as { type?: string })?.type;
        if (schemaType === "integer" || schemaType === "number") {
          args[key] = Number(val);
        } else if (schemaType === "boolean") {
          args[key] = val === "true";
        } else {
          args[key] = val;
        }
      }
    }

    // Include request body
    if (bodyValue.trim()) {
      try {
        args["body"] = JSON.parse(bodyValue);
      } catch {
        setError("Invalid JSON format in Request Body");
        setIsRunning(false);
        return;
      }
    }

    try {
      let res: Response;
      if (integrationId && integrationId !== "preview") {
        res = await fetch(`/api/openapi/integrations/${integrationId}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId: endpoint.operationId,
            arguments: args,
          }),
        });
      } else {
        res = await fetch("/api/openapi/test-raw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint,
            baseUrl,
            authType,
            authConfig,
            arguments: args,
          }),
        });
      }

      const json = await res.json();
      if (!res.ok || json.success === false) {
        setError(json.error || "Execution failed");
      } else {
        setTestResult(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during test");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono animate-in fade-in duration-100">
      <div className="relative w-full max-w-2xl max-h-[85vh] rounded-lg border border-slate-300 dark:border-indigo-900/80 bg-white dark:bg-[#08080c] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-[#0a0a0e]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${getMethodBadge(
                endpoint.method
              )}`}
            >
              {endpoint.method}
            </span>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide truncate">
                {endpoint.summary || endpoint.operationId}
              </h3>
              <p className="text-[10px] font-mono text-slate-500 truncate">{endpoint.path}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-indigo-950/40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
          {/* Parameters Form */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              REQUEST ARGUMENTS:
            </p>

            {endpoint.parameters.length === 0 && !endpoint.requestBody ? (
              <p className="text-[11px] text-slate-500 italic p-3 rounded border border-slate-200 dark:border-indigo-950 bg-slate-50/50 dark:bg-[#050508]">
                This endpoint requires no parameters or body.
              </p>
            ) : (
              <div className="space-y-2">
                {endpoint.parameters.map((param) => (
                  <div
                    key={param.name}
                    className="p-2.5 rounded border border-slate-200 dark:border-indigo-950 bg-slate-50/50 dark:bg-[#050508] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {param.name}
                        <span className="ml-1 text-[9px] uppercase text-indigo-400 font-semibold">
                          ({param.in})
                        </span>
                        {param.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {param.description || (param.schema as { type?: string })?.type || "string"}
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder={`Enter ${param.name}...`}
                      value={paramValues[param.name] ?? ""}
                      onChange={(e) =>
                        setParamValues({ ...paramValues, [param.name]: e.target.value })
                      }
                      className="w-full px-2.5 py-1 text-xs bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                ))}

                {endpoint.requestBody && (
                  <div className="p-2.5 rounded border border-slate-200 dark:border-indigo-950 bg-slate-50/50 dark:bg-[#050508] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        REQUEST BODY (JSON)
                        {endpoint.requestBody.required && (
                          <span className="text-red-500 ml-1 font-bold">*</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (endpoint.requestBody?.schema) {
                            setBodyValue(
                              JSON.stringify(
                                generateSampleJsonFromSchema(endpoint.requestBody.schema),
                                null,
                                2
                              )
                            );
                          }
                        }}
                        className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1 font-semibold uppercase cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" /> Auto-fill Sample
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      value={bodyValue}
                      onChange={(e) => setBodyValue(e.target.value)}
                      placeholder='{ "key": "value" }'
                      className="w-full font-mono text-xs p-2.5 bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Results Output */}
          {error && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-500/40 rounded text-red-800 dark:text-red-300 text-[11px] font-mono flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold uppercase">EXECUTION FAILED</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {testResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold uppercase text-slate-500">EXECUTION TRACE:</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${
                      testResult.status === "SUCCESS"
                        ? "border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-red-300 dark:border-red-700/60 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                    }`}
                  >
                    HTTP {testResult.statusCode || "ERR"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    <Clock className="w-2.5 h-2.5 inline mr-1" /> {testResult.latencyMs}ms
                  </span>
                </div>
              </div>

              {/* Terminal View */}
              <div className="p-3 bg-[#050508] border border-slate-800 rounded font-mono text-[11px] space-y-2 overflow-x-auto">
                <div className="flex items-center gap-2 text-indigo-400">
                  <span className="font-bold text-amber-400">{testResult.requestDetails.method}</span>
                  <span className="text-slate-300">{testResult.requestDetails.url}</span>
                </div>
                {testResult.data !== undefined && (
                  <div className="border-t border-slate-900 pt-1.5">
                    <p className="text-[9px] uppercase text-slate-500 font-bold mb-1">Payload Output:</p>
                    <pre className="text-emerald-400 text-[10px] overflow-x-auto max-h-48">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </div>
                )}
                {testResult.error && (
                  <div className="border-t border-slate-900 pt-1.5 text-red-400">
                    <p className="text-[9px] uppercase text-slate-500 font-bold mb-1">Error:</p>
                    <p>{testResult.error}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-[#0a0a0e]">
          <span className="text-[10px] text-slate-500">Runs live from server runtime</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase text-slate-600 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleRunTest}
              disabled={isRunning}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> Running...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" /> Execute Live Test
                </>
              )}
            </button>
          </div>
        </div>
      </div>
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

function generateSampleJsonFromSchema(schema: Record<string, unknown>): unknown {
  if (!schema || typeof schema !== "object") return "sample_value";

  if (schema.type === "object" && schema.properties) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
      res[k] = generateSampleJsonFromSchema(v);
    }
    return res;
  }

  if (schema.type === "array") {
    return [generateSampleJsonFromSchema((schema.items as Record<string, unknown>) || {})];
  }

  if (schema.type === "integer" || schema.type === "number") return 1;
  if (schema.type === "boolean") return true;
  if (schema.type === "string") {
    if (schema.enum && Array.isArray(schema.enum)) return schema.enum[0];
    return "example";
  }

  return {};
}
