"use client";

import React, { useState } from "react";
import { Database, Play, ChevronDown, ChevronUp, Plus, X, Upload } from "lucide-react";
import { EvalDataset } from "@/types/evals";
import { toast } from "@/stores/toastStore";

interface EvalDatasetsTabProps {
  datasets: EvalDataset[];
  onRunDataset: (dataset: EvalDataset) => void;
  onRefresh: () => void;
}

export function EvalDatasetsTab({ datasets, onRunDataset, onRefresh }: EvalDatasetsTabProps) {
  const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(datasets[0]?.id || null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("CUSTOM_TESTS");
  const [rawItemsJson, setRawItemsJson] = useState(
    JSON.stringify(
      [
        {
          id: "custom_01",
          input: { query: "How does our cancellation policy work?" },
          context: "Customers may cancel within 30 days for a full refund.",
          groundTruth: "Customers are eligible for a 100% refund within 30 days of purchase.",
          tags: ["support", "refunds"],
        },
      ],
      null,
      2
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateDataset = async () => {
    if (!name.trim()) {
      setError("Dataset name is required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const parsedItems = JSON.parse(rawItemsJson);
      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        throw new Error("Items must be a non-empty JSON array.");
      }

      const res = await fetch("/api/evals/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || "User Created Golden Dataset",
          category: category.toUpperCase().trim(),
          targetType: "MODEL",
          items: parsedItems,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create dataset.");
      }

      toast.success("Dataset Created", `Successfully added ${name}`);
      setCreateModalOpen(false);
      setName("");
      setDescription("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON format");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-indigo-950/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-indigo-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            GOLDEN TEST DATASETS ({datasets.length})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> CREATE NEW DATASET
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {datasets.map((ds) => {
          const isExpanded = expandedDatasetId === ds.id;
          return (
            <div
              key={ds.id}
              className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0c]/80 shadow-sm transition-all overflow-hidden"
            >
              {/* Dataset Header Row */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-black/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 uppercase">
                      {ds.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {ds.name}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                    {ds.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {ds.items.length} Test Samples
                  </span>
                  <button
                    type="button"
                    onClick={() => onRunDataset(ds)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-400 bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-500 transition-all shadow-sm cursor-pointer"
                  >
                    <Play className="h-3 w-3" /> EVALUATE ON DATASET
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedDatasetId(isExpanded ? null : ds.id)}
                    className="p-1.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-black text-slate-600 dark:text-slate-400 hover:text-indigo-400 cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expandable Test Cases Preview */}
              {isExpanded && (
                <div className="p-4 border-t border-slate-200 dark:border-indigo-950/80 bg-white dark:bg-black/50 space-y-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Included Golden Samples:
                  </div>

                  <div className="space-y-2">
                    {ds.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-indigo-950/60 bg-slate-50/70 dark:bg-slate-950/40 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-400">
                            #{idx + 1} Sample ID: {item.id}
                          </span>
                          {item.tags && (
                            <div className="flex items-center gap-1">
                              {item.tags.map((t) => (
                                <span
                                  key={t}
                                  className="text-[8px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-indigo-950/80 text-slate-700 dark:text-slate-300"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 text-[11px] font-sans">
                          <div>
                            <span className="font-mono text-[9px] font-bold uppercase text-slate-500 block">
                              Input Query:
                            </span>
                            <span className="text-slate-800 dark:text-slate-200">
                              {typeof item.input === "string" ? item.input : JSON.stringify(item.input)}
                            </span>
                          </div>

                          {item.context && (
                            <div className="pt-1">
                              <span className="font-mono text-[9px] font-bold uppercase text-violet-400 block">
                                Injected RAG Context:
                              </span>
                              <p className="text-[10px] text-slate-600 dark:text-slate-400 italic line-clamp-2">
                                {Array.isArray(item.context) ? item.context.join(" ") : item.context}
                              </p>
                            </div>
                          )}

                          {item.groundTruth && (
                            <div className="pt-1">
                              <span className="font-mono text-[9px] font-bold uppercase text-emerald-400 block">
                                Reference Ground Truth:
                              </span>
                              <span className="text-emerald-700 dark:text-emerald-300 text-[10px]">
                                {item.groundTruth}
                              </span>
                            </div>
                          )}
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

      {/* Create Custom Dataset Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl rounded-xl border border-indigo-500/40 bg-white dark:bg-[#0a0a0c] shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-indigo-950/80 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 font-pixel">
                  CREATE CUSTOM GOLDEN DATASET
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Dataset Name:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Healthcare QA Verification Golden Set"
                  className="w-full p-2.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Category:</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. HEALTHCARE_RAG"
                    className="w-full p-2 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Description:</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief purpose of the dataset"
                    className="w-full p-2 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                  <span>Test Samples JSON Array:</span>
                  <span className="text-[9px] text-indigo-400 font-normal">JSON Schema: [&#123; id, input, context?, groundTruth? &#125;]</span>
                </label>
                <textarea
                  value={rawItemsJson}
                  onChange={(e) => setRawItemsJson(e.target.value)}
                  rows={8}
                  className="w-full p-2.5 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-black/60 text-slate-900 dark:text-slate-100 font-mono text-[11px] leading-relaxed"
                />
              </div>

              {error && (
                <div className="p-2.5 rounded border border-red-500/40 bg-red-950/30 text-red-300 text-[11px]">
                  {error}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-indigo-950/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={handleCreateDataset}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-indigo-400 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> SAVE DATASET
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
