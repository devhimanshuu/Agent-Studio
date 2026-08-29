"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Play, Loader2, Sparkles, AlertCircle, Code } from "lucide-react";
import { executionsApi } from "@/lib/api/executions";
import { PinnedSkillDTO } from "@/types/dashboard";
import { toast } from "@/stores/toastStore";

interface QuickRunSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: PinnedSkillDTO[];
  initialSkillId?: string;
}

export function QuickRunSkillModal({
  isOpen,
  onClose,
  skills,
  initialSkillId,
}: QuickRunSkillModalProps) {
  const router = useRouter();
  const [selectedSkillId, setSelectedSkillId] = useState<string>(
    initialSkillId || skills[0]?.id || ""
  );
  const [inputJson, setInputJson] = useState<string>("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const currentSkill = skills.find((s) => s.id === selectedSkillId) || skills[0];

  useEffect(() => {
    if (initialSkillId) {
      setSelectedSkillId(initialSkillId);
    } else if (skills.length > 0 && !selectedSkillId) {
      setSelectedSkillId(skills[0].id);
    }
  }, [initialSkillId, skills, selectedSkillId]);

  useEffect(() => {
    if (currentSkill) {
      if (currentSkill.examples && currentSkill.examples.length > 0 && currentSkill.examples[0].input) {
        setInputJson(JSON.stringify(currentSkill.examples[0].input, null, 2));
      } else if (currentSkill.inputSchema && typeof currentSkill.inputSchema === "object") {
        const schema = currentSkill.inputSchema as { properties?: Record<string, { type?: string; default?: unknown }> };
        if (schema.properties) {
          const sample: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(schema.properties)) {
            sample[k] = v.default !== undefined ? v.default : v.type === "string" ? "sample value" : 0;
          }
          setInputJson(JSON.stringify(sample, null, 2));
        } else {
          setInputJson("{\n  \n}");
        }
      } else {
        setInputJson("{\n  \n}");
      }
      setJsonError(null);
    }
  }, [currentSkill]);

  if (!isOpen) return null;

  const handleJsonChange = (val: string) => {
    setInputJson(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON syntax");
    }
  };

  const handleRun = async () => {
    if (!currentSkill) return;

    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(inputJson);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON syntax");
      return;
    }

    setIsRunning(true);
    try {
      const execution = await executionsApi.start(currentSkill.versionId, parsedPayload);
      toast.success("Execution started", `Run ID: ${execution.id.slice(0, 8)}…`);
      onClose();
      router.push(`/dashboard/executions/${execution.id}`);
    } catch (error) {
      toast.error("Execution failed to launch", error instanceof Error ? error.message : "Server error");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-xl border border-indigo-400/80 dark:border-indigo-500/50 bg-white dark:bg-[#0c0c10] shadow-2xl overflow-hidden font-mono flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-indigo-950/80 bg-slate-50/70 dark:bg-black/50">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>QUICK TEST LAUNCHER</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-indigo-950/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Skill Selector */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              TARGET SKILL / AGENT
            </label>
            {skills.length === 0 ? (
              <p className="text-amber-600 dark:text-amber-400 text-xs">No active skills available to run.</p>
            ) : (
              <select
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-indigo-900/60 bg-white dark:bg-black/60 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
              >
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (v{s.versionNumber})
                  </option>
                ))}
              </select>
            )}
            {currentSkill && (
              <p className="text-[11px] text-slate-500 font-sans italic pt-0.5">{currentSkill.purpose}</p>
            )}
          </div>

          {/* Permitted Tools Tag Strip */}
          {currentSkill && currentSkill.allowedTools.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Available Tools for this run:
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {currentSkill.allowedTools.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Input JSON Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5 text-indigo-500" />
                <span>INPUT PAYLOAD (JSON)</span>
              </label>
              {currentSkill?.examples && currentSkill.examples.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setInputJson(JSON.stringify(currentSkill.examples[0].input, null, 2));
                    setJsonError(null);
                  }}
                  className="text-[10px] text-indigo-700 dark:text-indigo-400 hover:underline font-semibold"
                >
                  [ RESET TO EXAMPLE ]
                </button>
              )}
            </div>

            <textarea
              value={inputJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              rows={8}
              spellCheck={false}
              className={`w-full font-mono rounded-md border p-3 text-xs leading-relaxed focus:outline-none transition-all shadow-inner resize-y ${
                jsonError
                  ? "border-red-400 bg-red-50/20 dark:bg-red-950/20 text-red-900 dark:text-red-300 focus:border-red-500"
                  : "border-slate-300 dark:border-indigo-900/60 bg-slate-50/60 dark:bg-black/70 text-slate-900 dark:text-slate-100 focus:border-indigo-500"
              }`}
              placeholder="{\n  &quot;query&quot;: &quot;...&quot;\n}"
            />

            {jsonError && (
              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-[11px]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-indigo-950/80 bg-slate-50/70 dark:bg-black/50">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-md border border-slate-300 dark:border-indigo-900/60 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200/60 dark:hover:bg-indigo-950/40 transition-colors"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning || !currentSkill || Boolean(jsonError)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-indigo-400 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                STARTING RUN…
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                EXECUTE NOW
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
