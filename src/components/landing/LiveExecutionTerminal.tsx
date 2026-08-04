"use client";

import React, { useState } from "react";
import { Play, Lock, CheckCircle2, ShieldAlert, RefreshCw, Terminal, Check } from "lucide-react";

export function LiveExecutionTerminal() {
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [approvalGranted, setApprovalGranted] = useState(false);

  const handleRunSimulation = () => {
    setIsRunning(true);
    setStep(1);
    setApprovalGranted(false);

    setTimeout(() => setStep(2), 900);
    setTimeout(() => setStep(3), 1800);
  };

  const handleApproveWrite = () => {
    setApprovalGranted(true);
    setTimeout(() => setStep(4), 800);
  };

  const handleReset = () => {
    setIsRunning(false);
    setStep(0);
    setApprovalGranted(false);
  };

  return (
    <div className="rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-black font-mono shadow-xl dark:shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-950/50 overflow-hidden transition-all duration-200">
      {/* Terminal Bar */}
      <div className="px-3 sm:px-4 py-2.5 bg-slate-100/90 dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-indigo-950 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
          </div>
          <span className="text-slate-600 dark:text-slate-400 text-[11px] font-mono flex items-center gap-1.5 ml-1 sm:ml-2 truncate font-medium">
            <Terminal className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">agent-runtime --skill="CustomerSupportAssistant:v1"</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleRunSimulation}
              className="px-2 sm:px-2.5 py-1 rounded bg-indigo-600 text-white text-[10px] sm:text-[11px] font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3 w-3" /> [ RUN SIMULATION ]
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-1 rounded border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-indigo-950/40 text-slate-700 dark:text-slate-300 text-[10px] sm:text-[11px] hover:bg-slate-100 dark:hover:bg-indigo-900/60 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="h-3 w-3" /> [ RESET ]
            </button>
          )}
        </div>
      </div>

      {/* Terminal Display Content */}
      <div className="p-3 sm:p-5 space-y-3 text-xs min-h-[220px] sm:min-h-[280px]">
        {step === 0 && (
          <div className="text-slate-600 dark:text-slate-400 space-y-2">
            <p className="text-indigo-700 dark:text-indigo-400 font-semibold">// Click [ RUN SIMULATION ] to test real-time agent execution pipeline.</p>
            <p className="text-[11px] leading-relaxed">
              Skill: <span className="text-slate-900 dark:text-slate-200 font-semibold">CustomerSupportAssistant</span> (Published v1)
              <br />
              Permitted Tools: <span className="text-indigo-700 dark:text-indigo-300 font-medium">["calculator", "document_search", "mock_task_creator"]</span>
              <br />
              Actions Requiring Approval: <span className="text-amber-700 dark:text-amber-400 font-semibold">["mock_task_creator:create"]</span>
            </p>
          </div>
        )}

        {step >= 1 && (
          <div className="p-2.5 rounded bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-900 dark:text-slate-200 animate-fadeIn">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>planner NODE · deterministic plan generated</span>
            </div>
            <span className="text-[10px] text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-500/30 shrink-0 font-semibold">
              3 STEPS (0ms)
            </span>
          </div>
        )}

        {step >= 2 && (
          <div className="p-2.5 rounded bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-900 dark:text-slate-200 animate-fadeIn">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>permission + tool_selection · calculator:eval</span>
            </div>
            <span className="text-[10px] text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/50 border border-indigo-300 dark:border-indigo-500/30 shrink-0 font-semibold">
              AUTHORIZED: result=450
            </span>
          </div>
        )}

        {step === 3 && !approvalGranted && (
          <div className="p-3 rounded bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/50 text-amber-900 dark:text-amber-200 space-y-2 animate-pulse">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <Lock className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                <span>approval NODE · write action PAUSED for HITL</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 font-bold">
                AWAITING HITL
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 font-medium">
              Tool Action: <code className="text-amber-800 dark:text-amber-300 font-bold">mock_task_creator:create</code> | Payload: &#123;"title": "Refund #491"&#125;
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleApproveWrite}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Check className="h-3.5 w-3.5 shrink-0" /> <span className="leading-tight">[ GRANT HITL APPROVAL & CONSUME TOKEN ]</span>
              </button>
            </div>
          </div>
        )}

        {step >= 4 && (
          <>
            <div className="p-2.5 rounded bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>token consumed · write approved (single-use enforced)</span>
              </div>
              <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold shrink-0">APPROVED & WRITTEN</span>
            </div>

            <div className="p-3 rounded bg-slate-100 dark:bg-indigo-950/50 border border-slate-200 dark:border-indigo-500/40 space-y-1 text-slate-900 dark:text-slate-100 font-mono">
              <div className="text-xs text-indigo-700 dark:text-indigo-300 font-semibold">// finish NODE · FINAL OUTPUT GENERATED</div>
              <pre className="text-[11px] text-slate-800 dark:text-slate-300 overflow-x-auto font-mono">
                &#123; "status": "COMPLETED", "stepsCount": 3, "output": &#123; "ticketId": "TASK-9042", "refundCalculated": 450 &#125; &#125;
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
