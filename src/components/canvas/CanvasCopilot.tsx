"use client";

import React, { useCallback, useState } from "react";
import { Sparkles, Loader2, X, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { clsx } from "clsx";
import type { AgentGraphDefinition } from "@/types/graph";

interface CanvasCopilotProps {
  /** Called with the generated graph when the user submits a prompt. */
  onGraphGenerated: (graph: AgentGraphDefinition) => void;
  /** Whether the canvas is in trace mode (disables the copilot). */
  disabled?: boolean;
}

interface CopilotExample {
  label: string;
  prompt: string;
}

const EXAMPLES: CopilotExample[] = [
  {
    label: "Customer Support Pipeline",
    prompt:
      "Build a multi-agent customer support pipeline with an intent classifier, support agent, billing agent, and HITL gate for refunds > $500",
  },
  {
    label: "Research Assistant",
    prompt:
      "Create a research pipeline that searches the web, extracts key findings, summarizes them, and outputs a structured report",
  },
  {
    label: "Code Review Loop",
    prompt:
      "Design a code review loop: a coder agent writes code, a critic agent reviews it, and they iterate until approved or max 3 rounds",
  },
  {
    label: "RAG Pipeline",
    prompt:
      "Build a RAG pipeline with document retrieval, chunk embedding, a vector search step, and an LLM answer generation agent",
  },
];

/**
 * Canvas Copilot: Natural Language Graph Generator
 *
 * A prompt bar at the top of the canvas that takes a natural language description
 * and generates a full agent graph definition with nodes, prompts, and layouts.
 */
export function CanvasCopilot({ onGraphGenerated, disabled = false }: CanvasCopilotProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/canvas/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? `Generation failed (${res.status})`);
      }

      const data = await res.json();
      if (data.success && data.graph) {
        onGraphGenerated(data.graph);
        setPrompt("");
        setExpanded(false);
      } else {
        throw new Error(data.error ?? "No graph was generated");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating, onGraphGenerated]);

  const applyExample = useCallback((example: CopilotExample) => {
    setPrompt(example.prompt);
    setExpanded(false);
  }, []);

  if (disabled) return null;

  return (
    <div className="absolute left-1/2 top-2 z-30 -translate-x-1/2 w-[560px] max-w-[calc(100%-3rem)]">
      <div className="rounded-xl border border-indigo-500/40 bg-[#0a0a14]/95 backdrop-blur-md shadow-2xl shadow-indigo-500/10 font-mono overflow-hidden">
        {/* Main input row */}
        <div className="flex items-center gap-2 px-3 py-2">
          <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
          <input
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe your agent graph… e.g. 'Build a customer support pipeline with intent classification and HITL approval'"
            className="flex-1 bg-transparent text-[11px] text-white placeholder:text-slate-600 focus:outline-none"
            disabled={isGenerating}
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isGenerating}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
              prompt.trim() && !isGenerating
                ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> GENERATING…
              </>
            ) : (
              <>
                <Wand2 className="h-3 w-3" /> GENERATE
              </>
            )}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors cursor-pointer"
            title="Show examples"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-1.5 border-t border-red-500/30 bg-red-950/40 text-[9px] text-red-400">
            ✗ {error}
          </div>
        )}

        {/* Examples panel */}
        {expanded && (
          <div className="border-t border-indigo-500/20 px-3 py-2 space-y-1">
            <div className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-1">
              Example Prompts
            </div>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => applyExample(ex)}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/30 transition-all cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-indigo-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-indigo-300">{ex.label}</div>
                  <div className="text-[8px] text-slate-500 truncate">{ex.prompt}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
