"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Workflow,
  Plus,
  Trash2,
  CheckSquare,
  Wrench,
  FileText,
  Layers,
  Loader2,
  Check,
} from "lucide-react";
import { createSkillSchema } from "@/validators/skillSchema";
import { BUILT_IN_TOOL_CATALOG } from "@/modules/tools";
import { AvailableMcpTools } from "@/components/skills/AvailableMcpTools";
import { AvailableOpenApiTools } from "@/components/skills/AvailableOpenApiTools";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { WorkflowStepChain } from "./WorkflowStepChain";
import { toast } from "@/stores/toastStore";
import { clsx } from "clsx";

const formSchema = createSkillSchema.omit({ userId: true });
type FormValues = z.infer<typeof formSchema>;

interface WorkflowFormProps {
  mode: "create" | "edit";
  workflow?: SkillDTO | null;
  initialDraft?: SkillVersionDTO | null;
  initialTemplate?: Partial<FormValues> | null;
  onSubmit: (values: FormValues) => Promise<void>;
  isSubmitting?: boolean;
}

const COMMON_HITL_PRESETS = [
  "create_task",
  "disburse_funds",
  "execute_payment",
  "delete_record",
  "dispatch_security_alert",
  "send_external_webhook",
  "modify_database",
  "send_email_broadcast",
];

const inputClass =
  "w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-colors shadow-sm";
const labelClass = "text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-semibold";
const errorClass = "text-[10px] font-mono text-red-400 mt-1";

function JsonEditor({
  label,
  value,
  onChange,
  error,
  placeholder,
  fieldKey,
  onValidityChange,
}: {
  label: string;
  value: Record<string, unknown> | undefined;
  onChange: (v: Record<string, unknown>) => void;
  error?: string;
  placeholder?: string;
  fieldKey: string;
  onValidityChange: (key: string, valid: boolean) => void;
}) {
  const [raw, setRaw] = useState(() => (value ? JSON.stringify(value, null, 2) : ""));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    return () => onValidityChange(fieldKey, true);
  }, [fieldKey, onValidityChange]);

  const handleChange = (text: string) => {
    setRaw(text);
    if (!text.trim()) {
      setLocalError(null);
      onValidityChange(fieldKey, true);
      onChange({});
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) || parsed === null || typeof parsed !== "object") {
        throw new Error("Must be a JSON object");
      }
      setLocalError(null);
      onValidityChange(fieldKey, true);
      onChange(parsed);
    } catch {
      setLocalError("Invalid JSON");
      onValidityChange(fieldKey, false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className={labelClass}>{label}</label>
        {error && <span className="text-[10px] font-mono text-red-400">{error}</span>}
      </div>
      <textarea
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={placeholder ?? "{ }"}
        className={`${inputClass} font-mono text-[11px] leading-relaxed resize-y ${localError ? "border-red-500/60" : ""}`}
      />
      {localError && <p className={errorClass}>[ JSON ERROR ] {localError}</p>}
    </div>
  );
}

export function WorkflowForm({
  mode,
  workflow,
  initialDraft,
  initialTemplate,
  onSubmit,
  isSubmitting = false,
}: WorkflowFormProps) {
  const currentDraft = initialDraft ?? workflow?.currentDraft;
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});

  const handleValidityChange = useCallback((key: string, valid: boolean) => {
    setInvalidFields((prev) => {
      if (valid && !prev[key]) return prev;
      if (!valid && prev[key]) return prev;
      const next = { ...prev };
      if (valid) delete next[key];
      else next[key] = true;
      return next;
    });
  }, []);

  const defaultValues: FormValues = {
    name: workflow?.name ?? initialTemplate?.name ?? "",
    purpose: workflow?.purpose ?? initialTemplate?.purpose ?? "",
    instructions: currentDraft?.instructions ?? initialTemplate?.instructions ?? "",
    inputSchema: currentDraft?.inputSchema ?? initialTemplate?.inputSchema ?? { type: "object", properties: {} },
    outputSchema: currentDraft?.outputSchema ?? initialTemplate?.outputSchema ?? { type: "object", properties: {} },
    examples: currentDraft?.examples ?? initialTemplate?.examples ?? [],
    allowedTools: currentDraft?.allowedTools ?? initialTemplate?.allowedTools ?? [
      "document_search",
      "ai_extraction",
      "deterministic_condition",
      "final_report",
    ],
    actionsRequiringApproval: currentDraft?.actionsRequiringApproval ?? initialTemplate?.actionsRequiringApproval ?? [],
    maxExecutionSteps: currentDraft?.maxExecutionSteps ?? initialTemplate?.maxExecutionSteps ?? 10,
  };

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { fields: exampleFields, append: appendExample, remove: removeExample } = useFieldArray({
    control,
    name: "examples",
  });

  const allowedTools = watch("allowedTools") || [];
  const actionsRequiringApproval = watch("actionsRequiringApproval") || [];
  const [customActionInput, setCustomActionInput] = useState("");

  const toggleTool = (toolName: string) => {
    const next = allowedTools.includes(toolName)
      ? allowedTools.filter((t) => t !== toolName)
      : [...allowedTools, toolName];
    setValue("allowedTools", next, { shouldValidate: true });
  };

  const toggleApproval = (actionName: string) => {
    const next = actionsRequiringApproval.includes(actionName)
      ? actionsRequiringApproval.filter((a) => a !== actionName)
      : [...actionsRequiringApproval, actionName];
    setValue("actionsRequiringApproval", next, { shouldValidate: true });
  };

  const addCustomApproval = () => {
    const trimmed = customActionInput.trim();
    if (!trimmed) return;
    if (!actionsRequiringApproval.includes(trimmed)) {
      setValue("actionsRequiringApproval", [...actionsRequiringApproval, trimmed], { shouldValidate: true });
    }
    setCustomActionInput("");
  };

  const onValidSubmit = async (values: FormValues) => {
    if (Object.keys(invalidFields).length > 0) {
      toast.error("Invalid JSON", "Please fix the JSON errors before submitting.");
      return;
    }
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-8 font-mono">
      {/* Live Pipeline Preview Banner */}
      <div className="p-5 rounded border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-[#0a0a0a]/80 space-y-2 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
            <Workflow className="h-3.5 w-3.5" /> LIVE WORKFLOW STEP CHAIN PREVIEW
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            {allowedTools.length + 1} BOUNDED STEPS
          </span>
        </div>
        <WorkflowStepChain
          allowedTools={allowedTools}
          actionsRequiringApproval={actionsRequiringApproval}
        />
      </div>

      {/* SECTION 1: WORKFLOW IDENTITY */}
      <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 space-y-4 shadow-sm">
        <div className="border-b border-slate-200 dark:border-indigo-950 pb-3">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            01. WORKFLOW IDENTIFIER & PURPOSE
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Workflow Name</label>
            <input
              {...register("name")}
              placeholder="e.g. Customer Refund Bounded Automation"
              className={`${inputClass} mt-1`}
            />
            {errors.name && <p className={errorClass}>[ ERROR ] {errors.name.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Max Execution Steps</label>
            <input
              type="number"
              {...register("maxExecutionSteps", { valueAsNumber: true })}
              min={1}
              max={50}
              className={`${inputClass} mt-1`}
            />
            {errors.maxExecutionSteps && <p className={errorClass}>[ ERROR ] {errors.maxExecutionSteps.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Workflow Purpose & Business Outcome</label>
          <textarea
            {...register("purpose")}
            rows={2}
            placeholder="Describe what bounded business task this workflow automates..."
            className={`${inputClass} mt-1 font-sans text-xs`}
          />
          {errors.purpose && <p className={errorClass}>[ ERROR ] {errors.purpose.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Workflow Step Instructions & Logic</label>
          <textarea
            {...register("instructions")}
            rows={4}
            placeholder="1. Search knowledge policy. 2. Extract refund amount. 3. Evaluate deterministic condition. 4. If high value, request approval. 5. Generate final report."
            className={`${inputClass} mt-1 font-mono text-[11px]`}
          />
          {errors.instructions && <p className={errorClass}>[ ERROR ] {errors.instructions.message}</p>}
        </div>
      </div>

      {/* SECTION 2: 8 BOUNDED STEP NODES CONFIGURATION */}
      <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 space-y-4 shadow-sm">
        <div className="border-b border-slate-200 dark:border-indigo-950 pb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Wrench className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            02. BOUNDED STEP TOOLS & CAPABILITIES
          </h2>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {allowedTools.length} OF {BUILT_IN_TOOL_CATALOG.length} TOOLS ENABLED
          </span>
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
          Enable the deterministic step types and tools permitted for this workflow. The LangGraph runtime will strictly reject any tool not checked below.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {BUILT_IN_TOOL_CATALOG.map((tool) => {
            const isChecked = allowedTools.includes(tool.name);
            return (
              <div
                key={tool.name}
                onClick={() => toggleTool(tool.name)}
                className={clsx(
                  "p-3 rounded border cursor-pointer transition-all text-xs flex flex-col justify-between space-y-2 select-none",
                  isChecked
                    ? "border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/60 shadow-sm"
                    : "border-slate-200 dark:border-indigo-900/30 bg-slate-50/50 dark:bg-black/30 hover:border-slate-300 dark:hover:border-indigo-800"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                    {tool.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="accent-indigo-600 pointer-events-none"
                  />
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-serif leading-tight">
                  {tool.description}
                </p>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold self-start">
                  {tool.category} · {tool.type}
                </span>
              </div>
            );
          })}
        </div>

        <div className="pt-3 space-y-3">
          <AvailableMcpTools
            selected={allowedTools}
            onAdd={(name) => toggleTool(name)}
          />
          <AvailableOpenApiTools
            selected={allowedTools}
            onAdd={(name) => toggleTool(name)}
          />
        </div>
      </div>

      {/* SECTION 3: HITL HUMAN APPROVAL LOCKS */}
      <div className="p-6 rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-4 shadow-sm">
        <div className="border-b border-amber-200 dark:border-amber-900/50 pb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            03. HUMAN-IN-THE-LOOP (HITL) WRITE ACTION LOCKS
          </h2>
          <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold">
            [ IDEMPOTENT PAUSE ]
          </span>
        </div>

        <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 font-serif leading-relaxed">
          Actions selected below will pause workflow execution into <code className="text-amber-900 dark:text-amber-200 font-bold font-mono">PAUSED_FOR_APPROVAL</code> until reviewed by a user. Approval generates a single-use token to prevent replay duplicates.
        </p>

        <div className="space-y-3 pt-1">
          {/* Selected Actions Chips */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-900/80 dark:text-amber-300/80 font-bold mb-1.5">
              ACTIVE APPROVAL GATES ({actionsRequiringApproval.length})
            </div>
            {actionsRequiringApproval.length === 0 ? (
              <p className="text-[10px] text-slate-500 font-mono italic">
                No write actions locked. All tool executions will run autonomously without human pauses.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {actionsRequiringApproval.map((action) => (
                  <span
                    key={action}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-amber-400 bg-amber-200 dark:bg-amber-950 text-amber-950 dark:text-amber-200 text-xs font-mono font-bold shadow-sm"
                  >
                    <code>{action}</code>
                    <button
                      type="button"
                      onClick={() => toggleApproval(action)}
                      className="text-amber-800 dark:text-amber-400 hover:text-red-600 transition-colors cursor-pointer ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Custom Action Adder */}
          <div className="flex gap-2 pt-1">
            <input
              value={customActionInput}
              onChange={(e) => setCustomActionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomApproval();
                }
              }}
              placeholder="Type custom action name e.g. execute_payment, send_slack_alert…"
              className={`${inputClass} border-amber-300 dark:border-amber-900/50 bg-white dark:bg-black/60`}
            />
            <button
              type="button"
              onClick={addCustomApproval}
              className="shrink-0 px-3 py-2 rounded border border-amber-400 bg-amber-200 dark:bg-amber-900 text-xs font-mono font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-800 transition-all cursor-pointer"
            >
              + ADD ACTION
            </button>
          </div>

          {/* Preset Suggestions */}
          <div className="pt-2 border-t border-amber-200 dark:border-amber-900/40 space-y-1.5">
            <div className="text-[9px] font-mono uppercase tracking-widest text-amber-900/70 dark:text-amber-400/70 font-semibold">
              COMMON WRITE ACTION PRESETS (CLICK TO TOGGLE)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_HITL_PRESETS.map((action) => {
                const isSelected = actionsRequiringApproval.includes(action);
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => toggleApproval(action)}
                    className={clsx(
                      "inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-all cursor-pointer font-medium",
                      isSelected
                        ? "border-amber-500 bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-bold shadow-sm"
                        : "border-amber-300/80 dark:border-amber-900/50 bg-white/80 dark:bg-black/40 text-amber-900 dark:text-amber-300 hover:border-amber-400"
                    )}
                  >
                    {isSelected ? <Check className="h-2.5 w-2.5 shrink-0" /> : <Plus className="h-2.5 w-2.5 shrink-0" />}
                    <span>{action}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: SCHEMAS & EXAMPLES */}
      <div className="p-6 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 space-y-6 shadow-sm">
        <div className="border-b border-slate-200 dark:border-indigo-950 pb-3">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            04. INPUT & OUTPUT JSON SCHEMAS
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Controller
            control={control}
            name="inputSchema"
            render={({ field }) => (
              <JsonEditor
                label="Structured Input Schema (JSON Schema)"
                value={field.value}
                onChange={field.onChange}
                error={typeof errors.inputSchema?.message === "string" ? errors.inputSchema.message : undefined}
                fieldKey="inputSchema"
                onValidityChange={handleValidityChange}
              />
            )}
          />

          <Controller
            control={control}
            name="outputSchema"
            render={({ field }) => (
              <JsonEditor
                label="Expected Output Schema (JSON Schema)"
                value={field.value}
                onChange={field.onChange}
                error={typeof errors.outputSchema?.message === "string" ? errors.outputSchema.message : undefined}
                fieldKey="outputSchema"
                onValidityChange={handleValidityChange}
              />
            )}
          />
        </div>

        {/* Few-Shot Examples */}
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-indigo-950">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Few-Shot Workflow Test Examples</label>
            <button
              type="button"
              onClick={() => appendExample({ input: {}, output: {} })}
              className="inline-flex items-center gap-1 text-[11px] text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-bold cursor-pointer"
            >
              <Plus className="h-3 w-3" /> ADD EXAMPLE
            </button>
          </div>

          {exampleFields.map((field, idx) => (
            <div
              key={field.id}
              className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/60 dark:bg-black/40 space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Example #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeExample(idx)}
                  className="text-red-500 hover:text-red-700 cursor-pointer p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Controller
                  control={control}
                  name={`examples.${idx}.input`}
                  render={({ field: inputField }) => (
                    <JsonEditor
                      label="Sample Input Payload"
                      value={inputField.value}
                      onChange={inputField.onChange}
                      fieldKey={`examples.${idx}.input`}
                      onValidityChange={handleValidityChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`examples.${idx}.output`}
                  render={({ field: outputField }) => (
                    <JsonEditor
                      label="Expected Output Payload"
                      value={outputField.value}
                      onChange={outputField.onChange}
                      fieldKey={`examples.${idx}.output`}
                      onValidityChange={handleValidityChange}
                    />
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-indigo-950">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-3 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all text-xs cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              SAVING WORKFLOW...
            </>
          ) : mode === "create" ? (
            "[ SAVE AS WORKFLOW DRAFT ]"
          ) : (
            "[ UPDATE WORKFLOW DRAFT ]"
          )}
        </button>
      </div>
    </form>
  );
}
