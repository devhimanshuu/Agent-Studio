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
    <div className="rounded border border-indigo-900/50 bg-black font-mono shadow-2xl shadow-indigo-950/50 overflow-hidden">
      {/* Terminal Bar */}
      <div className="px-4 py-2.5 bg-[#0a0a0a] border-b border-indigo-950 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
          </div>
          <span className="text-slate-400 text-[11px] font-mono flex items-center gap-1.5 ml-2 truncate">
            <Terminal className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            agent-runtime --skill="CustomerSupportAssistant:v1"
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isRunning ? (
            <button
              onClick={handleRunSimulation}
              className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500 transition-all flex items-center gap-1"
            >
              <Play className="h-3 w-3" /> [ RUN SIMULATION ]
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="px-2 py-1 rounded border border-indigo-900/60 bg-indigo-950/40 text-slate-300 text-[11px] hover:text-white transition-all flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> [ RESET ]
            </button>
          )}
        </div>
      </div>

      {/* Terminal Display Content */}
      <div className="p-5 space-y-3 text-xs min-h-[280px]">
        {step === 0 && (
          <div className="text-slate-400 space-y-2">
            <p className="text-indigo-400 font-semibold">// Click [ RUN SIMULATION ] to test real-time agent execution pipeline.</p>
            <p className="text-[11px] leading-relaxed">
              Skill: <span className="text-slate-200">CustomerSupportAssistant</span> (Published v1)
              <br />
              Permitted Tools: <span className="text-indigo-300">["calculator", "document_search", "mock_task_creator"]</span>
              <br />
              Actions Requiring Approval: <span className="text-amber-400">["mock_task_creator:create"]</span>
            </p>
          </div>
        )}

        {step >= 1 && (
          <div className="p-2.5 rounded bg-indigo-950/30 border border-indigo-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>STEP 1: Input JSON Schema Validation</span>
            </div>
            <span className="text-[10px] text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 shrink-0">
              PASSED (0ms)
            </span>
          </div>
        )}

        {step >= 2 && (
          <div className="p-2.5 rounded bg-indigo-950/30 border border-indigo-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
              <span>STEP 2: Permitted Tool Check (calculator:eval)</span>
            </div>
            <span className="text-[10px] text-indigo-300 px-2 py-0.5 rounded bg-indigo-950/50 border border-indigo-500/30 shrink-0">
              SUCCESS: result=450
            </span>
          </div>
        )}

        {step === 3 && !approvalGranted && (
          <div className="p-3 rounded bg-amber-950/30 border border-amber-500/50 text-amber-200 space-y-2 animate-pulse">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <Lock className="h-4 w-4 shrink-0" />
                <span>STEP 3: Write Action PAUSED — Requires Human Approval</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                AWAITING HITL
              </span>
            </div>
            <p className="text-[11px] text-amber-200/80">
              Tool Action: <code className="text-amber-300">mock_task_creator:create</code> | Payload: &#123;"title": "Refind #491"&#125;
            </p>
            <div className="pt-1">
              <button
                onClick={handleApproveWrite}
                className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" /> [ GRANT HITL APPROVAL & CONSUME TOKEN ]
              </button>
            </div>
          </div>
        )}

        {step >= 4 && (
          <>
            <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-emerald-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>STEP 3: Single-Use Idempotency Token Consumed</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold shrink-0">APPROVED & WRITTEN</span>
            </div>

            <div className="p-3 rounded bg-indigo-950/50 border border-indigo-500/40 space-y-1 text-slate-100 font-mono">
              <div className="text-xs text-indigo-300 font-semibold">// FINAL OUTPUT GENERATED</div>
              <pre className="text-[11px] text-slate-300 overflow-x-auto">
                &#123; "status": "COMPLETED", "stepsCount": 3, "output": &#123; "ticketId": "TASK-9042", "refundCalculated": 450 &#125; &#125;
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
