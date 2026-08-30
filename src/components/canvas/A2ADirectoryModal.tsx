"use client";

import React, { useState } from "react";
import {
  Network,
  Search,
  ExternalLink,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { A2A_AGENT_PRESETS } from "@/modules/a2a/presets";
import { A2AAgentManifest } from "@/types/a2a";

interface A2ADirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent: (agent: A2AAgentManifest) => void;
}

export function A2ADirectoryModal({ isOpen, onClose, onSelectAgent }: A2ADirectoryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveredAgent, setDiscoveredAgent] = useState<A2AAgentManifest | null>(null);

  if (!isOpen) return null;

  const filteredPresets = A2A_AGENT_PRESETS.filter((agent) => {
    const q = searchQuery.toLowerCase();
    return (
      agent.name.toLowerCase().includes(q) ||
      (agent.displayName ?? "").toLowerCase().includes(q) ||
      agent.description.toLowerCase().includes(q) ||
      (agent.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleDiscoverCustom = async () => {
    if (!customUrl.trim()) return;
    setDiscovering(true);
    setDiscoveryError(null);
    setDiscoveredAgent(null);

    try {
      const res = await fetch(`/api/a2a/discover?url=${encodeURIComponent(customUrl.trim())}`);
      const data = await res.json();
      if (data.success && data.manifest) {
        setDiscoveredAgent(data.manifest);
      } else {
        setDiscoveryError(data.error || "Failed to discover agent manifest from endpoint.");
      }
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : "Network discovery failed.");
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-mono animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-2xl border border-indigo-500/30 bg-[#0c0d18] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-500/20 bg-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
                  A2A Agent Directory
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  A2A Protocol v1.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Discover any real A2A-compliant agent by URL and drag it onto your multi-agent canvas.
                This app has no external agent registry — the list below is only agents you've added.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search & Custom Discovery Bar */}
        <div className="p-4 border-b border-indigo-500/10 space-y-3 bg-slate-950/40">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by agent name, capability, or tag (e.g. 'research', 'audit', 'finance')..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-indigo-500/20 bg-black/40 text-[10px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 font-mono"
            />
          </div>

          <div className="flex gap-2">
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="Import any custom A2A Agent URL (e.g. https://my-agent.com/a2a)..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-black/40 text-[10px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 font-mono"
            />
            <button
              onClick={handleDiscoverCustom}
              disabled={discovering || !customUrl.trim()}
              className="px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {discovering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Discover
            </button>
          </div>

          {discoveryError && (
            <div className="p-2 rounded bg-red-950/30 border border-red-500/30 text-[9px] text-red-300 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />
              {discoveryError}
            </div>
          )}

          {discoveredAgent && (
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/40 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-100">{discoveredAgent.displayName || discoveredAgent.name}</span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/30 text-purple-300">Verified Manifest</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{discoveredAgent.description}</p>
              </div>
              <button
                onClick={() => {
                  onSelectAgent(discoveredAgent);
                  onClose();
                }}
                className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[9px] font-bold uppercase flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add to Canvas
              </button>
            </div>
          )}
        </div>

        {/* Directory Presets List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold px-1">
            Curated A2A Agent Presets ({filteredPresets.length})
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredPresets.map((agent) => (
              <div
                key={agent.name}
                className="p-3.5 rounded-xl border border-indigo-500/20 bg-slate-900/40 hover:border-purple-500/50 hover:bg-purple-950/10 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-[11px] text-slate-100 leading-tight">
                      {agent.displayName || agent.name}
                    </div>
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[7.5px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      v{agent.version}
                    </span>
                  </div>
                  <p className="text-[8.5px] text-slate-400 leading-relaxed line-clamp-2">
                    {agent.description}
                  </p>

                  <div className="pt-1 flex flex-wrap gap-1">
                    {agent.capabilities.map((cap) => (
                      <span
                        key={cap.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-[7.5px] text-slate-300"
                        title={cap.description}
                      >
                        <Zap className="h-2 w-2 text-cyan-400 shrink-0" />
                        <span>{cap.name}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="text-[7.5px] text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    Auth: {agent.auth?.type || "none"}
                  </div>
                  <button
                    onClick={() => {
                      onSelectAgent(agent);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded bg-indigo-600/80 hover:bg-indigo-500 text-white text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    <Plus className="h-2.5 w-2.5" /> Add to Canvas
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-indigo-500/10 bg-slate-950/80 flex items-center justify-between text-[8px] text-slate-400">
          <span>Agent Studio is the world&apos;s first visual A2A orchestration platform.</span>
          <a
            href="https://google.com"
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:underline flex items-center gap-1"
          >
            A2A Spec Docs <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
