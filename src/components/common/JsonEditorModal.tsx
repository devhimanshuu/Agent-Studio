"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Copy,
  Check,
  Clipboard,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileJson,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "@/stores/toastStore";

interface JsonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onApply: (updatedValue: string) => void;
  title?: string;
  onResetSample?: () => void;
}

export function JsonEditorModal({
  isOpen,
  onClose,
  value,
  onApply,
  title = "EXECUTION INPUT · EXPANDED JSON EDITOR",
  onResetSample,
}: JsonEditorModalProps) {
  const [localValue, setLocalValue] = useState(value);
  const [copied, setCopied] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonStats, setJsonStats] = useState<{ keys: number; bytes: number } | null>(null);

  const validate = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setJsonError(null);
      setJsonStats({ keys: 0, bytes: 0 });
      return true;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setJsonError("JSON root must be an object { ... }");
        setJsonStats(null);
        return false;
      }
      setJsonError(null);
      setJsonStats({
        keys: Object.keys(parsed).length,
        bytes: new Blob([trimmed]).size,
      });
      return true;
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON syntax");
      setJsonStats(null);
      return false;
    }
  }, []);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalValue(value);
      validate(value);
    }
  }, [isOpen, value, validate]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleChange = (text: string) => {
    setLocalValue(text);
    validate(text);
  };

  const handlePrettify = () => {
    try {
      const trimmed = localValue.trim();
      if (!trimmed) return;
      const parsed = JSON.parse(trimmed);
      const formatted = JSON.stringify(parsed, null, 2);
      setLocalValue(formatted);
      validate(formatted);
      toast.success("JSON formatted");
    } catch {
      toast.error("Format failed", "Fix JSON syntax errors first.");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localValue);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.info("Clipboard is empty");
        return;
      }
      setLocalValue(text);
      validate(text);
      toast.success("Pasted from clipboard");
    } catch {
      toast.error("Paste failed", "Clipboard permission denied.");
    }
  };

  const handleApply = () => {
    if (jsonError) {
      toast.error("Cannot apply", "Please fix JSON syntax errors.");
      return;
    }
    onApply(localValue);
    onClose();
    toast.success("Execution input updated");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl rounded-xl border border-slate-200 dark:border-indigo-500/30 bg-white dark:bg-[#0d0d18] shadow-2xl shadow-indigo-500/10 font-mono flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-indigo-950/80 px-4 py-3 bg-slate-50/70 dark:bg-black/40 shrink-0">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {onResetSample && (
              <button
                type="button"
                onClick={() => {
                  onResetSample();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors cursor-pointer"
                title="Reset to sample schema"
              >
                <RotateCcw className="h-3 w-3" /> Reset Sample
              </button>
            )}

            <button
              type="button"
              onClick={handlePrettify}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 text-[10px] text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
              title="Prettify and format JSON"
            >
              <Sparkles className="h-3 w-3 text-indigo-500" /> Format
            </button>

            <button
              type="button"
              onClick={handlePaste}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              title="Paste from clipboard"
            >
              <Clipboard className="h-3 w-3" /> Paste
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              title="Copy to clipboard"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col bg-white dark:bg-[#07070f]">
          <div className="flex-1 relative rounded-lg border border-slate-200 dark:border-indigo-950 bg-slate-50/40 dark:bg-black/70 overflow-hidden flex flex-col focus-within:border-indigo-500 transition-colors">
            <textarea
              value={localValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="{\n  &quot;query&quot;: &quot;...&quot;,\n  &quot;payload&quot;: {}\n}"
              spellCheck={false}
              className="w-full flex-1 p-4 bg-transparent text-xs font-mono text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none resize-none leading-relaxed overflow-y-auto"
            />
          </div>
        </div>

        {/* Validation & Status Bar */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-indigo-950/60 bg-slate-50/60 dark:bg-black/30 flex items-center justify-between text-[11px] shrink-0">
          <div>
            {jsonError ? (
              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold">
                <AlertCircle className="h-3.5 w-3.5" /> {jsonError}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Valid JSON Object
                {jsonStats && (
                  <span className="text-slate-400 font-normal ml-2">
                    ({jsonStats.keys} top-level {jsonStats.keys === 1 ? "key" : "keys"}, {jsonStats.bytes} bytes)
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="button"
              disabled={Boolean(jsonError)}
              onClick={handleApply}
              className={clsx(
                "px-4 py-1.5 rounded border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                !jsonError
                  ? "border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
              )}
            >
              APPLY & CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
