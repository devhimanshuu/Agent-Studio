"use client";

import React from "react";
import {
  Layers,
  Search,
  Cpu,
  SlidersHorizontal,
  GitBranch,
  CheckSquare,
  Wrench,
  FileText,
  Calculator,
  Database,
  ArrowRight,
} from "lucide-react";
import { clsx } from "clsx";

interface WorkflowStepChainProps {
  allowedTools: string[];
  actionsRequiringApproval?: string[];
  compact?: boolean;
}

interface StepNodeDef {
  id: string;
  name: string;
  toolName?: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  borderClass: string;
  bgClass: string;
}

const STEP_TOOL_MAP: Record<string, StepNodeDef> = {
  document_search: {
    id: "doc_search",
    name: "Doc Search",
    toolName: "document_search",
    icon: Search,
    colorClass: "text-cyan-700 dark:text-cyan-400",
    borderClass: "border-cyan-300 dark:border-cyan-700/50",
    bgClass: "bg-cyan-50 dark:bg-cyan-950/40",
  },
  ai_extraction: {
    id: "ai_extract",
    name: "AI Extraction",
    toolName: "ai_extraction",
    icon: Cpu,
    colorClass: "text-indigo-700 dark:text-indigo-400",
    borderClass: "border-indigo-300 dark:border-indigo-700/50",
    bgClass: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  ai_classification: {
    id: "ai_classify",
    name: "AI Classification",
    toolName: "ai_classification",
    icon: SlidersHorizontal,
    colorClass: "text-purple-700 dark:text-purple-400",
    borderClass: "border-purple-300 dark:border-purple-700/50",
    bgClass: "bg-purple-50 dark:bg-purple-950/40",
  },
  deterministic_condition: {
    id: "condition",
    name: "Condition Rule",
    toolName: "deterministic_condition",
    icon: GitBranch,
    colorClass: "text-emerald-700 dark:text-emerald-400",
    borderClass: "border-emerald-300 dark:border-emerald-700/50",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  calculator: {
    id: "calculator",
    name: "Calculator",
    toolName: "calculator",
    icon: Calculator,
    colorClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-300 dark:border-blue-700/50",
    bgClass: "bg-blue-50 dark:bg-blue-950/40",
  },
  record_lookup: {
    id: "record_lookup",
    name: "Record Lookup",
    toolName: "record_lookup",
    icon: Database,
    colorClass: "text-sky-700 dark:text-sky-400",
    borderClass: "border-sky-300 dark:border-sky-700/50",
    bgClass: "bg-sky-50 dark:bg-sky-950/40",
  },
  mock_task_creator: {
    id: "mock_action",
    name: "Action Dispatch",
    toolName: "mock_task_creator",
    icon: Wrench,
    colorClass: "text-rose-700 dark:text-rose-400",
    borderClass: "border-rose-300 dark:border-rose-700/50",
    bgClass: "bg-rose-50 dark:bg-rose-950/40",
  },
  final_report: {
    id: "final_report",
    name: "Final Report",
    toolName: "final_report",
    icon: FileText,
    colorClass: "text-teal-700 dark:text-teal-400",
    borderClass: "border-teal-300 dark:border-teal-700/50",
    bgClass: "bg-teal-50 dark:bg-teal-950/40",
  },
};

export function WorkflowStepChain({
  allowedTools = [],
  actionsRequiringApproval = [],
  compact = false,
}: WorkflowStepChainProps) {
  // Construct ordered sequence
  const steps: StepNodeDef[] = [
    {
      id: "input",
      name: "Structured Input",
      icon: Layers,
      colorClass: "text-slate-700 dark:text-slate-300",
      borderClass: "border-slate-300 dark:border-slate-700/50",
      bgClass: "bg-slate-50 dark:bg-slate-900/40",
    },
  ];

  // Map allowed tools
  for (const toolName of allowedTools) {
    if (STEP_TOOL_MAP[toolName]) {
      steps.push(STEP_TOOL_MAP[toolName]);
    }
  }

  // If there's an action requiring approval, inject HITL node
  const hasHitl = actionsRequiringApproval.length > 0;
  if (hasHitl) {
    steps.splice(steps.length > 1 ? steps.length - 1 : 1, 0, {
      id: "hitl",
      name: "HITL Approval Lock",
      icon: CheckSquare,
      colorClass: "text-amber-700 dark:text-amber-400",
      borderClass: "border-amber-300 dark:border-amber-700/50",
      bgClass: "bg-amber-50 dark:bg-amber-950/40",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isLast = idx === steps.length - 1;
        return (
          <React.Fragment key={`${step.id}-${idx}`}>
            <div
              className={clsx(
                "inline-flex items-center gap-1.5 rounded border px-2 py-1 transition-colors shadow-2xl",
                step.bgClass,
                step.borderClass,
                step.colorClass,
                compact ? "text-[10px] py-0.5 px-1.5" : "text-xs"
              )}
            >
              <Icon className={compact ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
              <span className="font-semibold whitespace-nowrap">{step.name}</span>
            </div>
            {!isLast && (
              <ArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-600 shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
