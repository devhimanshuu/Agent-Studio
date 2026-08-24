"use client";

import React, { useState, useCallback } from "react";
import { Sparkles, Loader2, Wand2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import type { AgentGraphDefinition } from "@/types/graph";

interface CanvasCopilotProps {
  /** Called with the generated graph when the user submits a prompt. */
  onGraphGenerated: (graph: AgentGraphDefinition) => void;
  /** Whether the canvas is in trace mode (disables the copilot). */
  disabled?: boolean;
  /** Position of the copilot bar: top (default) or bottom. */
  position?: "top" | "bottom";
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
export function CanvasCopilot({ onGraphGenerated, disabled = false, position = "bottom" }: CanvasCopilotProps) {
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

  const isBottom = position === "bottom";

  return (
    <div
      className={clsx(
        "absolute left-1/2 z-40 -translate-x-1/2 w-[600px] max-w-[calc(100%-3rem)] transition-all",
        isBottom ? "bottom-5" : "top-3"
      )}
    >
      <div className="rounded-xl border border-slate-200 dark:border-indigo-500/40 bg-white/95 dark:bg-[#0a0a14]/95 backdrop-blur-md shadow-2xl shadow-indigo-500/20 font-mono overflow-hidden flex flex-col">
        {/* If positioned at bottom, expanded examples appear above the input */}
        {expanded && isBottom && (
          <div className="border-b border-slate-200 dark:border-indigo-500/20 px-3 py-2.5 space-y-1 bg-slate-50/50 dark:bg-black/30 max-h-52 overflow-y-auto">
            <div className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-1">
              Example Prompts (Talk to Graph)
            </div>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => applyExample(ex)}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-indigo-50/80 dark:hover:bg-indigo-500/10 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300">{ex.label}</div>
                  <div className="text-[8px] text-slate-500 truncate">{ex.prompt}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-1.5 border-b border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-950/40 text-[9px] text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </div>
        )}

        {/* Main input row */}
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0 animate-pulse" />
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
            placeholder="Talk to graph… e.g. 'Build a customer support pipeline with intent classification and HITL approval'"
            className="flex-1 bg-transparent text-[11px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            disabled={isGenerating}
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isGenerating}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
              prompt.trim() && !isGenerating
                ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/25 active:scale-95"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
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
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
            title="Show examples"
          >
            {expanded ? (
              isBottom ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              isBottom ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* If positioned at top, expanded examples appear below the input */}
        {expanded && !isBottom && (
          <div className="border-t border-slate-200 dark:border-indigo-500/20 px-3 py-2 space-y-1">
            <div className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-1">
              Example Prompts
            </div>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => applyExample(ex)}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-indigo-50/80 dark:hover:bg-indigo-500/10 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300">{ex.label}</div>
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
