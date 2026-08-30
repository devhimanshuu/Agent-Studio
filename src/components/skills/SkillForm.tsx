import React, { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash2,
  Save,
  Wrench,
  CheckSquare,
  ListChecks,
  Loader2,
  Workflow,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Cpu,
} from "lucide-react";
import { createSkillSchema } from "@/validators/skillSchema";
import { BUILT_IN_TOOL_CATALOG, TOOL_CATEGORIES } from "@/modules/tools";
import { AvailableMcpTools } from "./AvailableMcpTools";
import { AvailableOpenApiTools } from "./AvailableOpenApiTools";
import { ApprovalActionMarketplace } from "./ApprovalActionMarketplace";
import { QuickConnectToolModal } from "./QuickConnectToolModal";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { WorkflowStepChain } from "@/components/workflows/WorkflowStepChain";
import { toast } from "@/stores/toastStore";
import { clsx } from "clsx";

// Client-side form schema: same rules as the API validator, minus userId.
const formSchema = createSkillSchema.omit({ userId: true });
type FormValues = z.infer<typeof formSchema>;

interface SkillFormProps {
  mode: "create" | "edit";
  skill?: SkillDTO | null;
  initialDraft?: SkillVersionDTO | null;
  initialTemplate?: Partial<FormValues> | null;
  onSubmit: (values: FormValues) => Promise<void>;
  isSubmitting?: boolean;
}


const inputClass =
  "w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-colors shadow-sm";
const labelClass = "text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400/80 font-semibold";
const errorClass = "text-[10px] font-mono text-red-400 mt-1";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={errorClass}>[ ERROR ] {message}</p>;
}

// RHF nested array/field errors are a Merge<FieldError, FieldErrorsImpl> —
// extract the message string safely.
function fieldMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : undefined;
  }
  return undefined;
}

function exampleFieldError(errors: unknown, index: number, field: "input" | "output"): unknown {
  if (!errors || typeof errors !== "object") return undefined;
  const examples = (errors as { examples?: unknown }).examples;
  if (!examples || typeof examples !== "object" || !Array.isArray(examples)) return undefined;
  const item = examples[index];
  if (!item || typeof item !== "object") return undefined;
  return (item as Record<string, unknown>)[field];
}

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

  // If this editor unmounts (e.g. an example row is removed) while holding an
  // invalid state, drop it from the invalid set so it can't block submission.
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

/** Quick-add picker of the built-in tools, grouped by registry category. */
function AvailableTools({ selected, onAdd }: { selected: string[]; onAdd: (name: string) => void }) {
  const available = BUILT_IN_TOOL_CATALOG.filter((t) => !selected.includes(t.name));
  if (available.length === 0) return null;
  return (
    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-indigo-950/60">
      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-500 font-medium">
        AVAILABLE TOOLS BY CATEGORY
      </div>
      {TOOL_CATEGORIES.map((cat) => {
        const tools = available.filter((t) => t.category === cat.id);
        if (tools.length === 0) return null;
        return (
          <div key={cat.id} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-mono text-indigo-400/70 uppercase tracking-wider w-16 shrink-0">
              {cat.label}
            </span>
            {tools.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => onAdd(t.name)}
                className="px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 text-[10px] font-mono text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 transition-all cursor-pointer font-medium"
              >
                + {t.name}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TagsInput({
  label,
  values,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  error?: string;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const value = input.trim();
    if (!value) return;
    if (!values.includes(value)) {
      onChange([...values, value]);
    }
    setInput("");
  };

  return (
    <div>
      <label className={`${labelClass} block mb-1.5`}>{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-mono text-indigo-800 dark:text-indigo-200 font-medium"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 px-3 py-2 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 dark:hover:text-white transition-all cursor-pointer"
        >
          ADD
        </button>
      </div>
      {error && <p className={errorClass}>[ ERROR ] {error}</p>}
    </div>
  );
}

function BuilderModeGuide({
  toolCount,
  approvalCount,
}: {
  toolCount: number;
  approvalCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isWorkflow = toolCount > 1 || approvalCount > 0;

  return (
    <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-amber-50/60 dark:from-indigo-950/40 dark:via-[#0a0a0a] dark:to-amber-950/20 p-3.5 space-y-2 shadow-sm font-mono transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isWorkflow ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700/60 text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              <Workflow className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              MODE: WORKFLOW PIPELINE ({toolCount} tools · {approvalCount} approvals)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-700/60 text-[10px] font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">
              <Cpu className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              MODE: ATOMIC SKILL ({toolCount === 0 ? "Prompt-only" : "Single capability"})
            </span>
          )}
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            {isWorkflow
              ? "Configured as a multi-step sequential business pipeline."
              : "Configured as an atomic reusable AI capability."}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 uppercase tracking-wider transition-colors cursor-pointer"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {isOpen ? "HIDE GUIDE" : "SKILL VS WORKFLOW GUIDE"}
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Expandable Guide Tooltip */}
      {isOpen && (
        <div className="pt-2 border-t border-slate-200 dark:border-indigo-950/70 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Skill Mode Explanation */}
          <div className="p-3 rounded border border-indigo-200 dark:border-indigo-900/40 bg-white/90 dark:bg-black/50 space-y-1.5">
            <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] uppercase tracking-wide">
              <Cpu className="h-3.5 w-3.5" /> Building an Atomic Skill
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
              Use this when you want a <strong>single focused capability</strong> (e.g. <em>Forex Rate Fetcher</em>, <em>SQL Generator</em>, <em>Text Classifier</em>).
            </p>
            <ul className="text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5 list-disc list-inside">
              <li>Select <strong>0 or 1 tool</strong> in Allowed Tools</li>
              <li>Leave <strong>Actions Requiring Approval</strong> empty</li>
              <li>Define strict <strong>Input & Output JSON Schemas</strong></li>
              <li><span className="text-indigo-600 dark:text-indigo-400 font-bold">Reusable</span> across entire workspace & Agent Canvas</li>
            </ul>
          </div>

          {/* Workflow Mode Explanation */}
          <div className="p-3 rounded border border-amber-200 dark:border-amber-900/40 bg-white/90 dark:bg-black/50 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold text-[11px] uppercase tracking-wide">
              <Workflow className="h-3.5 w-3.5" /> Building a Workflow Pipeline
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed">
              Use this when you want a <strong>multi-step business process</strong> (e.g. <em>Customer Refund Automation</em>, <em>Invoice Audit</em>, <em>Lead CRM Triage</em>).
            </p>
            <ul className="text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5 list-disc list-inside">
              <li>Chain <strong>2+ sequential tools</strong> in Allowed Tools</li>
              <li>Select write actions under <strong>Actions Requiring Approval (HITL)</strong></li>
              <li>Write step-by-step instructions (<em>1. Search ➔ 2. Extract ➔ 3. Approve ➔ 4. Report</em>)</li>
              <li><span className="text-amber-600 dark:text-amber-400 font-bold">Executes</span> as a bounded autonomous workflow</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function SkillForm({
  mode,
  skill,
  initialDraft,
  initialTemplate,
  onSubmit,
  isSubmitting = false,
}: SkillFormProps) {
  const draft = initialDraft ?? skill?.currentDraft ?? null;

  // Tracks editors currently showing invalid JSON. JsonEditor only reports
  // parsed values upward, so without this the form would silently submit the
  // last valid value while the user sees a red error — losing their edits.
  const invalidJsonKeys = useRef<Set<string>>(new Set());
  const setJsonValidity = useCallback((key: string, valid: boolean) => {
    if (valid) invalidJsonKeys.current.delete(key);
    else invalidJsonKeys.current.add(key);
  }, []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: skill?.name ?? initialTemplate?.name ?? "",
      purpose: skill?.purpose ?? initialTemplate?.purpose ?? "",
      instructions: draft?.instructions ?? initialTemplate?.instructions ?? "",
      inputSchema: draft?.inputSchema ?? initialTemplate?.inputSchema ?? {},
      outputSchema: draft?.outputSchema ?? initialTemplate?.outputSchema ?? {},
      examples: draft?.examples?.length ? draft.examples : initialTemplate?.examples?.length ? initialTemplate.examples : [],
      allowedTools: draft?.allowedTools?.length ? draft.allowedTools : initialTemplate?.allowedTools?.length ? initialTemplate.allowedTools : [],
      actionsRequiringApproval: draft?.actionsRequiringApproval ?? initialTemplate?.actionsRequiringApproval ?? [],
      approvalPolicy: draft?.approvalPolicy ?? initialTemplate?.approvalPolicy ?? {
        alwaysRequireApproval: false,
        neverRequireApproval: false,
        toolBasedApproval: [],
        skillBasedApproval: [],
      },
      maxExecutionSteps: draft?.maxExecutionSteps ?? initialTemplate?.maxExecutionSteps ?? 10,
      notes: draft?.notes ?? "",
    },
  });

  const allowedTools = watch("allowedTools") || [];
  const actionsRequiringApproval = watch("actionsRequiringApproval") || [];
  const instructions = watch("instructions") || "";
  const [isQuickConnectOpen, setIsQuickConnectOpen] = useState(false);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "examples",
  });

  const onValidSubmit = handleSubmit(async (values) => {
    if (invalidJsonKeys.current.size > 0) {
      toast.error("Invalid JSON", "Fix the highlighted JSON fields before saving");
      return;
    }
    await onSubmit(values);
  });

  return (
    <form onSubmit={onValidSubmit} className="space-y-6 font-mono" noValidate>
      {/* Dynamic Skill vs Workflow Mode Guide Banner & Tooltip */}
      <BuilderModeGuide
        toolCount={allowedTools.length}
        approvalCount={actionsRequiringApproval.length}
      />

      {/* Live Pipeline Preview Banner */}
      <div className="p-4 rounded border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-[#0a0a0a]/80 space-y-2 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
            <Workflow className="h-3.5 w-3.5" /> LIVE PIPELINE STEP CHAIN
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            {allowedTools.length + 1} STEPS CONFIGURED
          </span>
        </div>
        <WorkflowStepChain
          allowedTools={allowedTools}
          actionsRequiringApproval={actionsRequiringApproval}
        />
      </div>

      {/* Name & Purpose */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={`${labelClass} block mb-1.5`}>Workflow / Skill Name *</label>
          <input {...register("name")} placeholder="e.g. Customer Refund Bounded Automation" className={inputClass} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <label className={`${labelClass} block mb-1.5`}>Purpose & Outcome *</label>
          <input {...register("purpose")} placeholder="What bounded business outcome does this achieve?" className={inputClass} />
          <FieldError message={errors.purpose?.message} />
        </div>
      </div>

      {/* Instructions */}

      <div>
        <label className={`${labelClass} block mb-1.5`}>Instructions *</label>
        <textarea
          {...register("instructions")}
          rows={4}
          placeholder="Step-by-step instructions the agent follows when executing this skill…"
          className={`${inputClass} resize-y leading-relaxed`}
        />
        <FieldError message={errors.instructions?.message} />
      </div>

      {/* JSON Schemas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Controller
          control={control}
          name="inputSchema"
          render={({ field }) => (
            <JsonEditor
              label="Input Schema (JSON)"
              value={field.value}
              onChange={field.onChange}
              error={fieldMessage(errors.inputSchema)}
              fieldKey="inputSchema"
              onValidityChange={setJsonValidity}
              placeholder={'{ "type": "object", "properties": { } }'}
            />
          )}
        />
        <Controller
          control={control}
          name="outputSchema"
          render={({ field }) => (
            <JsonEditor
              label="Output Schema (JSON)"
              value={field.value}
              onChange={field.onChange}
              error={fieldMessage(errors.outputSchema)}
              fieldKey="outputSchema"
              onValidityChange={setJsonValidity}
              placeholder={'{ "type": "object", "properties": { } }'}
            />
          )}
        />
      </div>

      {/* Examples */}
      <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <label className={`${labelClass} flex items-center gap-1.5`}>
            <ListChecks className="h-3.5 w-3.5" /> Examples
          </label>
          <button
            type="button"
            onClick={() => append({ input: {}, output: {}, description: "" })}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-mono text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 transition-all cursor-pointer font-semibold"
          >
            <Plus className="h-3 w-3" /> ADD EXAMPLE
          </button>
        </div>

        {fields.length === 0 && (
          <p className="text-[11px] text-slate-500">No examples yet. Add input/output pairs to demonstrate expected behavior.</p>
        )}

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded border border-slate-200 dark:border-indigo-900/30 bg-slate-50/80 dark:bg-black/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400/70">
                  EXAMPLE #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove example ${index + 1}`}
                  className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Controller
                control={control}
                name={`examples.${index}.input`}
                render={({ field: f }) => (
                  <JsonEditor
                    label="Input"
                    value={f.value}
                    onChange={f.onChange}
                    error={fieldMessage(exampleFieldError(errors, index, "input"))}
                    fieldKey={`examples.${index}.input`}
                    onValidityChange={setJsonValidity}
                    placeholder='{ "query": "…" }'
                  />
                )}
              />
              <Controller
                control={control}
                name={`examples.${index}.output`}
                render={({ field: f }) => (
                  <JsonEditor
                    label="Output"
                    value={f.value}
                    onChange={f.onChange}
                    error={fieldMessage(exampleFieldError(errors, index, "output"))}
                    fieldKey={`examples.${index}.output`}
                    onValidityChange={setJsonValidity}
                    placeholder='{ "result": "…" }'
                  />
                )}
              />
              <div>
                <label className={`${labelClass} block mb-1.5`}>Description (optional)</label>
                <input {...register(`examples.${index}.description`)} placeholder="Explain this example…" className={inputClass} />
              </div>
            </div>
          ))}
        </div>
        <FieldError message={fieldMessage(errors.examples)} />
      </div>

      {/* Allowed Tools & Approval Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Controller
          control={control}
          name="allowedTools"
          render={({ field }) => (
            <div className="rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <label className={`${labelClass} flex items-center gap-1.5`}>
                  <Wrench className="h-3.5 w-3.5 text-indigo-600" /> Allowed Tools * <span className="text-slate-500">(min 1)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickConnectOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/70 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="h-3 w-3" /> Quick-Connect Public APIs & Tools
                </button>
              </div>

              <TagsInput
                label=""
                values={field.value ?? []}
                onChange={field.onChange}
                error={fieldMessage(errors.allowedTools)}
                placeholder="e.g. calculator, document_search…"
              />

              <AvailableTools
                selected={field.value ?? []}
                onAdd={(name) => field.onChange([...(field.value ?? []), name])}
              />
              <AvailableMcpTools
                selected={field.value ?? []}
                onAdd={(name) => field.onChange([...(field.value ?? []), name])}
              />
              <AvailableOpenApiTools
                selected={field.value ?? []}
                onAdd={(name) => field.onChange([...(field.value ?? []), name])}
              />

              {/* Quick Connect Modal */}
              <QuickConnectToolModal
                isOpen={isQuickConnectOpen}
                onClose={() => setIsQuickConnectOpen(false)}
                selectedTools={field.value ?? []}
                onAddTool={(toolName) => {
                  if (!field.value?.includes(toolName)) {
                    field.onChange([...(field.value ?? []), toolName]);
                  }
                }}
              />
            </div>
          )}
        />
        <Controller
          control={control}
          name="actionsRequiringApproval"
          render={({ field }) => (
            <div className="rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <label className={`${labelClass} flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold`}>
                  <CheckSquare className="h-3.5 w-3.5 text-amber-600" /> Actions Requiring Approval (HITL)
                </label>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 font-bold">
                  IDEMPOTENT PAUSE
                </span>
              </div>
              <p className="text-[10px] text-amber-900/80 dark:text-amber-400/80 font-serif leading-tight">
                When an agent attempts these write actions, execution will pause into <code className="font-mono font-bold">PAUSED_FOR_APPROVAL</code> until reviewed by a user.
              </p>

              {/* Action Marketplace, Auto-Binding & Policy Profiles */}
              <ApprovalActionMarketplace
                selected={field.value ?? []}
                onChange={field.onChange}
                allowedTools={allowedTools}
                instructions={instructions}
              />
            </div>
          )}
        />
        <Controller
          control={control}
          name="approvalPolicy"
          render={({ field }) => {
            const policy = field.value ?? {
              alwaysRequireApproval: false,
              neverRequireApproval: false,
              toolBasedApproval: [],
              skillBasedApproval: [],
            };
            const toolBasedApproval = policy.toolBasedApproval ?? [];

            return (
              <div className="rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50/60 dark:bg-[#0a0a0a]/60 p-4 space-y-3 shadow-sm">
                <label className={`${labelClass} flex items-center gap-1.5`}>
                  <CheckSquare className="h-3.5 w-3.5 text-indigo-500" /> Approval Policy Overrides
                </label>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-serif leading-tight">
                  Evaluated before the per-action list above: an override here always wins.
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      field.onChange({
                        ...policy,
                        alwaysRequireApproval: !policy.alwaysRequireApproval,
                        neverRequireApproval: false,
                      })
                    }
                    className={clsx(
                      "px-2.5 py-1.5 rounded border text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
                      policy.alwaysRequireApproval
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-slate-300 dark:border-indigo-900/50 text-slate-600 dark:text-slate-400 hover:border-amber-400"
                    )}
                  >
                    Always require approval
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      field.onChange({
                        ...policy,
                        neverRequireApproval: !policy.neverRequireApproval,
                        alwaysRequireApproval: false,
                      })
                    }
                    className={clsx(
                      "px-2.5 py-1.5 rounded border text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
                      policy.neverRequireApproval
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-slate-300 dark:border-indigo-900/50 text-slate-600 dark:text-slate-400 hover:border-red-400"
                    )}
                  >
                    Never require approval
                  </button>
                </div>

                {policy.neverRequireApproval && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                    ⚠ Overrides every tool's own WRITE/requiresApproval contract — actions execute without human review.
                  </p>
                )}

                {allowedTools.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      Always pause for these tools (independent of the action list above)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {allowedTools.map((toolName) => {
                        const active = toolBasedApproval.includes(toolName);
                        return (
                          <button
                            key={toolName}
                            type="button"
                            onClick={() =>
                              field.onChange({
                                ...policy,
                                toolBasedApproval: active
                                  ? toolBasedApproval.filter((t) => t !== toolName)
                                  : [...toolBasedApproval, toolName],
                              })
                            }
                            className={clsx(
                              "px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer",
                              active
                                ? "border-indigo-500 bg-indigo-600 text-white"
                                : "border-slate-300 dark:border-indigo-900/50 text-slate-600 dark:text-slate-400 hover:border-indigo-400"
                            )}
                          >
                            {toolName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Max Steps & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className={`${labelClass} block mb-1.5`}>Max Execution Steps *</label>
          <input
            type="number"
            min={1}
            max={100}
            {...register("maxExecutionSteps", {
              // Empty input → undefined (schema treats it as optional, the
              // repository defaults to 10). valueAsNumber would produce NaN and
              // surface a confusing "Expected number, received nan" error.
              setValueAs: (v) => (v === "" ? undefined : Number(v)),
            })}
            className={inputClass}
          />
          <FieldError message={errors.maxExecutionSteps?.message} />
        </div>
        <div className="md:col-span-2">
          <label className={`${labelClass} block mb-1.5`}>Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            placeholder="Internal notes about this skill (not part of execution)…"
            className={`${inputClass} resize-y`}
          />
          <FieldError message={errors.notes?.message} />
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-indigo-950/60">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-3 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {mode === "create" ? "[ CREATE SKILL ]" : "[ SAVE DRAFT ]"}
        </button>
      </div>
    </form>
  );
}
