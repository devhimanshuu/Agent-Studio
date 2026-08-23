"use client";

import React, { useState } from "react";
import {
  X,
  Globe,
  FileCode,
  ArrowRight,
  ArrowLeft,
  Check,
  Search,
  ShieldAlert,
  Loader2,
  Lock,
  Play,
} from "lucide-react";
import { clsx } from "clsx";
import {
  OpenApiAuthConfig,
  OpenApiAuthType,
  OpenApiEndpointDefinition,
  OpenApiParsedSpecDTO,
} from "@/types/openapi";
import { OpenApiEndpointTesterModal } from "./OpenApiEndpointTesterModal";

interface OpenApiImportModalProps {
  isOpen: boolean;
  initialSpecUrl?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

const SAMPLE_PRESETS = [
  {
    name: "Swagger Petstore v2",
    description: "Classic Swagger 2.0 Petstore sample spec with CRUD operations",
    url: "https://petstore.swagger.io/v2/swagger.json",
  },
  {
    name: "JSONPlaceholder REST API",
    description: "Fake online REST API for posts, users, comments and todos",
    url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/uspto.json",
  },
];

export function OpenApiImportModal({ isOpen, initialSpecUrl, onClose, onSuccess }: OpenApiImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Source
  const [sourceType, setSourceType] = useState<"URL" | "RAW">("URL");
  const [specUrl, setSpecUrl] = useState(initialSpecUrl || "");
  const [rawSpecText, setRawSpecText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedSpec, setParsedSpec] = useState<OpenApiParsedSpecDTO | null>(null);

  React.useEffect(() => {
    if (initialSpecUrl) {
      setSpecUrl(initialSpecUrl);
      setSourceType("URL");
    }
  }, [initialSpecUrl]);

  // Step 2: Configuration & Selection
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [endpoints, setEndpoints] = useState<OpenApiEndpointDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, _setSelectedTag] = useState<string>("ALL");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");

  // Step 3: Auth
  const [authType, setAuthType] = useState<OpenApiAuthType>("NONE");
  const [bearerToken, setBearerToken] = useState("");
  const [apiKeyHeader, setApiKeyHeader] = useState("X-API-Key");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyQueryParam, setApiKeyQueryParam] = useState("api_key");
  const [apiKeyLocation, setApiKeyLocation] = useState<"HEADER" | "QUERY">("HEADER");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");
  const [customHeaderKey, setCustomHeaderKey] = useState("");
  const [customHeaderVal, setCustomHeaderVal] = useState("");

  // Testing & Saving
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState<OpenApiEndpointDefinition | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    setIsParsing(true);
    setParseError(null);

    try {
      const payload =
        sourceType === "URL"
          ? { specUrl: specUrl.trim() }
          : { rawSpec: rawSpecText.trim() };

      const res = await fetch("/api/openapi/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        setParseError(json.error || "Failed to parse OpenAPI specification");
        return;
      }

      const data: OpenApiParsedSpecDTO = json.data;
      setParsedSpec(data);
      setName(data.title || "Imported REST API");
      setDescription(data.description || `Generated tools from ${data.title}`);
      setBaseUrl(data.baseUrl || "https://api.example.com");
      setEndpoints(data.endpoints);
      setStep(2);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Parsing error");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveIntegration = async () => {
    setIsSaving(true);
    setSaveError(null);

    const selectedEndpoints = endpoints.filter((ep) => ep.enabled);
    if (selectedEndpoints.length === 0) {
      setSaveError("Please select at least one endpoint to import as a tool.");
      setIsSaving(false);
      return;
    }

    const authConfig: OpenApiAuthConfig = {};
    if (authType === "BEARER") {
      authConfig.bearerToken = bearerToken;
    } else if (authType === "API_KEY") {
      if (apiKeyLocation === "HEADER") {
        authConfig.apiKeyHeader = apiKeyHeader;
        authConfig.apiKeyValue = apiKeyValue;
      } else {
        authConfig.apiKeyQueryParam = apiKeyQueryParam;
        authConfig.apiKeyValue = apiKeyValue;
      }
    } else if (authType === "BASIC") {
      authConfig.basicUsername = basicUsername;
      authConfig.basicPassword = basicPassword;
    } else if (authType === "CUSTOM_HEADER" && customHeaderKey.trim()) {
      authConfig.customHeaders = { [customHeaderKey.trim()]: customHeaderVal };
    }

    try {
      const res = await fetch("/api/openapi/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          specUrl: sourceType === "URL" ? specUrl.trim() : undefined,
          rawSpec: parsedSpec?.rawSpec || {},
          baseUrl: baseUrl.trim(),
          authType,
          authConfig: Object.keys(authConfig).length > 0 ? authConfig : undefined,
          endpoints: selectedEndpoints,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        setSaveError(json.error || "Failed to create OpenAPI integration");
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error saving integration");
    } finally {
      setIsSaving(false);
    }
  };

  const _allTags = Array.from(new Set(endpoints.flatMap((e) => e.tags)));
  const filteredEndpoints = endpoints.filter((ep) => {
    const matchesSearch =
      ep.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.operationId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === "ALL" || ep.tags.includes(selectedTag);
    const matchesMethod = selectedMethod === "ALL" || ep.method === selectedMethod;
    return matchesSearch && matchesTag && matchesMethod;
  });

  const enabledCount = endpoints.filter((e) => e.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono animate-in fade-in duration-100">
      <div className="relative w-full max-w-3xl max-h-[85vh] rounded-lg border border-slate-300 dark:border-indigo-900/80 bg-white dark:bg-[#08080c] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-[#0a0a0e]">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-500" />
            <h2 className="text-xs font-pixel text-pixel-glow text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
              IMPORT OPENAPI SPECIFICATION
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-indigo-950/40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="flex items-center gap-4 px-5 py-2.5 bg-slate-100/50 dark:bg-[#050508] border-b border-slate-200 dark:border-indigo-950 text-[10px] font-mono font-semibold uppercase tracking-wider overflow-x-auto">
          <span className={clsx("flex items-center gap-1.5", step >= 1 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500")}>
            <span>01</span> SOURCE
          </span>
          <span className="text-slate-400 dark:text-slate-700">/</span>
          <span className={clsx("flex items-center gap-1.5", step >= 2 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500")}>
            <span>02</span> ENDPOINTS ({pad(enabledCount)})
          </span>
          <span className="text-slate-400 dark:text-slate-700">/</span>
          <span className={clsx("flex items-center gap-1.5", step >= 3 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500")}>
            <span>03</span> AUTH & CONFIG
          </span>
          <span className="text-slate-400 dark:text-slate-700">/</span>
          <span className={clsx("flex items-center gap-1.5", step >= 4 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500")}>
            <span>04</span> REVIEW
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-mono">
          {/* STEP 1: SOURCE SPEC */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSourceType("URL")}
                  className={clsx(
                    "flex-1 py-2 px-3 rounded border text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer",
                    sourceType === "URL"
                      ? "border-indigo-500 bg-indigo-600 text-white shadow-xs"
                      : "border-slate-300 dark:border-indigo-950/80 bg-slate-50 dark:bg-[#0a0a0e] text-slate-700 dark:text-slate-400 hover:border-indigo-400"
                  )}
                >
                  <Globe className="w-3.5 h-3.5" /> Spec URL (JSON / YAML)
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType("RAW")}
                  className={clsx(
                    "flex-1 py-2 px-3 rounded border text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer",
                    sourceType === "RAW"
                      ? "border-indigo-500 bg-indigo-600 text-white shadow-xs"
                      : "border-slate-300 dark:border-indigo-950/80 bg-slate-50 dark:bg-[#0a0a0e] text-slate-700 dark:text-slate-400 hover:border-indigo-400"
                  )}
                >
                  <FileCode className="w-3.5 h-3.5" /> Paste Raw Payload
                </button>
              </div>

              {sourceType === "URL" ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      OpenAPI / Swagger Spec URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://petstore.swagger.io/v2/swagger.json"
                      value={specUrl}
                      onChange={(e) => setSpecUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#050508] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="pt-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Sample Specifications:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SAMPLE_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setSpecUrl(preset.url)}
                          className="p-2.5 text-left bg-slate-50 dark:bg-[#08080c] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 border border-slate-200 dark:border-indigo-950/80 rounded transition-all cursor-pointer"
                        >
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase truncate">
                            {preset.name}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Paste OpenAPI 3.0 / 3.1 or Swagger 2.0 Document
                  </label>
                  <textarea
                    rows={10}
                    placeholder='{ "openapi": "3.0.0", "info": { "title": "My API", "version": "1.0.0" }, "paths": { ... } }'
                    value={rawSpecText}
                    onChange={(e) => setRawSpecText(e.target.value)}
                    className="w-full font-mono text-xs p-3 bg-slate-50 dark:bg-[#050508] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {parseError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-500/40 rounded text-red-800 dark:text-red-300 text-[11px] font-mono">
                  {parseError}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SELECT ENDPOINTS */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search endpoints by path or operation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#050508] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <select
                    value={selectedMethod}
                    onChange={(e) => setSelectedMethod(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-[#050508] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">All Methods</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = endpoints.every((e) => e.enabled);
                      setEndpoints(endpoints.map((e) => ({ ...e, enabled: !allSelected })));
                    }}
                    className="px-2.5 py-1.5 text-[10px] font-mono font-semibold uppercase rounded border border-indigo-300 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 cursor-pointer"
                  >
                    {endpoints.every((e) => e.enabled) ? "Deselect All" : "Select All"}
                  </button>
                </div>
              </div>

              {/* Endpoint List */}
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                {filteredEndpoints.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-500">No matching endpoints found.</p>
                ) : (
                  filteredEndpoints.map((ep) => (
                    <div
                      key={ep.id}
                      className={clsx(
                        "p-2.5 rounded border transition-all flex items-center justify-between gap-3",
                        ep.enabled
                          ? "bg-white dark:bg-[#0a0a0e] border-slate-300 dark:border-indigo-950/80"
                          : "bg-slate-50 dark:bg-[#060608] border-slate-200 dark:border-indigo-950/40 opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={ep.enabled}
                          onChange={(e) => {
                            setEndpoints(
                              endpoints.map((item) =>
                                item.id === ep.id ? { ...item, enabled: e.target.checked } : item
                              )
                            );
                          }}
                          className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 dark:border-indigo-950"
                        />
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${getMethodBadge(
                            ep.method
                          )}`}
                        >
                          {ep.method}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                            {ep.summary || ep.operationId}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 truncate">{ep.path}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ep.requiresApproval}
                            onChange={(e) => {
                              setEndpoints(
                                endpoints.map((item) =>
                                  item.id === ep.id
                                    ? { ...item, requiresApproval: e.target.checked }
                                    : item
                                )
                              );
                            }}
                            className="w-3 h-3 rounded text-amber-600"
                          />
                          <span className="flex items-center gap-0.5">
                            <ShieldAlert className="w-2.5 h-2.5 text-amber-500" /> HITL
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={() => setTestingEndpoint(ep)}
                          className="px-2 py-0.5 text-[9px] font-mono font-semibold uppercase text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800/80 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" /> Test
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 3: AUTH & BASE URL */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Integration Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#050508] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Target Base URL
                  </label>
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#050508] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Auth Strategy */}
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Auth Strategy
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {(["NONE", "BEARER", "API_KEY", "BASIC", "CUSTOM_HEADER"] as OpenApiAuthType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAuthType(type)}
                      className={clsx(
                        "py-1.5 px-2 rounded border text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer",
                        authType === type
                          ? "border-indigo-500 bg-indigo-600 text-white shadow-xs"
                          : "border-slate-300 dark:border-indigo-950/80 bg-slate-50 dark:bg-[#0a0a0e] text-slate-700 dark:text-slate-400 hover:border-indigo-400"
                      )}
                    >
                      {type.replace("_", " ")}
                    </button>
                  ))}
                </div>

                {/* Auth Config Inputs */}
                {authType === "BEARER" && (
                  <div className="p-3 bg-slate-50 dark:bg-[#06060a] border border-slate-200 dark:border-indigo-950 rounded space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Bearer Token
                    </label>
                    <input
                      type="password"
                      placeholder="Bearer token value..."
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                )}

                {authType === "API_KEY" && (
                  <div className="p-3 bg-slate-50 dark:bg-[#06060a] border border-slate-200 dark:border-indigo-950 rounded space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setApiKeyLocation("HEADER")}
                        className={clsx(
                          "px-2 py-0.5 text-[9px] font-semibold uppercase rounded border cursor-pointer",
                          apiKeyLocation === "HEADER"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "border-slate-300 dark:border-indigo-950 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        Header
                      </button>
                      <button
                        type="button"
                        onClick={() => setApiKeyLocation("QUERY")}
                        className={clsx(
                          "px-2 py-0.5 text-[9px] font-semibold uppercase rounded border cursor-pointer",
                          apiKeyLocation === "QUERY"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "border-slate-300 dark:border-indigo-950 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        Query Param
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {apiKeyLocation === "HEADER" ? (
                        <div>
                          <label className="text-[9px] font-semibold uppercase text-slate-500">Header Name</label>
                          <input
                            type="text"
                            value={apiKeyHeader}
                            onChange={(e) => setApiKeyHeader(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 font-mono"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[9px] font-semibold uppercase text-slate-500">Query Param</label>
                          <input
                            type="text"
                            value={apiKeyQueryParam}
                            onChange={(e) => setApiKeyQueryParam(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 font-mono"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-slate-500">API Key Value</label>
                        <input
                          type="password"
                          value={apiKeyValue}
                          onChange={(e) => setApiKeyValue(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {authType === "BASIC" && (
                  <div className="p-3 bg-slate-50 dark:bg-[#06060a] border border-slate-200 dark:border-indigo-950 rounded space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-slate-500">Username</label>
                        <input
                          type="text"
                          value={basicUsername}
                          onChange={(e) => setBasicUsername(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-slate-500">Password</label>
                        <input
                          type="password"
                          value={basicPassword}
                          onChange={(e) => setBasicPassword(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {authType === "CUSTOM_HEADER" && (
                  <div className="p-3 bg-slate-50 dark:bg-[#06060a] border border-slate-200 dark:border-indigo-950 rounded space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-slate-500">Header Name</label>
                        <input
                          type="text"
                          placeholder="e.g. X-Custom-Auth"
                          value={customHeaderKey}
                          onChange={(e) => setCustomHeaderKey(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-semibold uppercase text-slate-500">Header Value</label>
                        <input
                          type="password"
                          value={customHeaderVal}
                          onChange={(e) => setCustomHeaderVal(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-[#09090e] border border-slate-300 dark:border-indigo-950 rounded text-slate-800 dark:text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & SAVE */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">
                    {name}
                  </h3>
                  <span className="px-2 py-0.5 text-[9px] font-mono font-semibold uppercase rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/60">
                    {pad(enabledCount)} TOOLS TO MOUNT
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">BASE URL:</span>
                    <p className="font-mono text-slate-800 dark:text-slate-200 truncate">{baseUrl}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">AUTH:</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{authType}</p>
                  </div>
                </div>
              </div>

              {saveError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-500/40 rounded text-red-800 dark:text-red-300 text-[11px] font-mono">
                  {saveError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-[#0a0a0e]">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-100 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase text-slate-600 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>

            {step === 1 && (
              <button
                onClick={handleParse}
                disabled={isParsing || (sourceType === "URL" ? !specUrl : !rawSpecText)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Parsing...
                  </>
                ) : (
                  <>
                    Next <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            )}

            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={enabledCount === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                Next <ArrowRight className="w-3 h-3" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 cursor-pointer"
              >
                Next <ArrowRight className="w-3 h-3" />
              </button>
            )}

            {step === 4 && (
              <button
                onClick={handleSaveIntegration}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-indigo-500 bg-indigo-600 text-white text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Mounting...
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3" /> Complete & Mount Tools
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Test Modal */}
      {testingEndpoint && (
        <OpenApiEndpointTesterModal
          endpoint={testingEndpoint}
          baseUrl={baseUrl}
          authType={authType}
          authConfig={{
            bearerToken,
            apiKeyHeader,
            apiKeyValue,
            apiKeyQueryParam,
            basicUsername,
            basicPassword,
            customHeaders: customHeaderKey ? { [customHeaderKey]: customHeaderVal } : undefined,
          }}
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
