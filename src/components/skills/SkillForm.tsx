"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Sparkles, Wrench, CheckSquare, ListChecks, Loader2 } from "lucide-react";
import { createSkillSchema } from "@/validators/skillSchema";
import { SkillDTO, SkillVersionDTO } from "@/types/skill";
import { toast } from "@/stores/toastStore";

// Client-side form schema: same rules as the API validator, minus userId.
const formSchema = createSkillSchema.omit({ userId: true });
type FormValues = z.infer<typeof formSchema>;

interface SkillFormProps {
  mode: "create" | "edit";
  skill?: SkillDTO | null;
  initialDraft?: SkillVersionDTO | null;
  onSubmit: (values: FormValues) => Promise<void>;
  isSubmitting?: boolean;
}

const inputClass =
  "w-full rounded border border-indigo-900/50 bg-[#0a0a0a] px-3 py-2 text-xs text-slate-100 font-mono placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none transition-colors";
const labelClass = "text-[10px] font-mono uppercase tracking-widest text-indigo-400/80";
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
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-indigo-900/50 bg-indigo-950/40 text-[10px] font-mono text-indigo-200"
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
          className="shrink-0 px-3 py-2 rounded border border-indigo-500/40 bg-indigo-950/40 text-xs font-mono text-indigo-300 hover:border-indigo-400 hover:text-white transition-all cursor-pointer"
        >
          ADD
        </button>
      </div>
      {error && <p className={errorClass}>[ ERROR ] {error}</p>}
    </div>
  );
}

export function SkillForm({ mode, skill, initialDraft, onSubmit, isSubmitting = false }: SkillFormProps) {
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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: skill?.name ?? "",
      purpose: skill?.purpose ?? "",
      instructions: draft?.instructions ?? "",
      inputSchema: draft?.inputSchema ?? {},
      outputSchema: draft?.outputSchema ?? {},
      examples: draft?.examples?.length ? draft.examples : [],
      allowedTools: draft?.allowedTools?.length ? draft.allowedTools : [],
      actionsRequiringApproval: draft?.actionsRequiringApproval ?? [],
      maxExecutionSteps: draft?.maxExecutionSteps ?? 10,
      notes: draft?.notes ?? "",
    },
  });

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
      {/* Name & Purpose */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={`${labelClass} block mb-1.5`}>Skill Name *</label>
          <input {...register("name")} placeholder="e.g. Customer Sentiment Analyzer" className={inputClass} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <label className={`${labelClass} block mb-1.5`}>Purpose *</label>
          <input {...register("purpose")} placeholder="What problem does this skill solve?" className={inputClass} />
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
      <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <label className={`${labelClass} flex items-center gap-1.5`}>
            <ListChecks className="h-3.5 w-3.5" /> Examples
          </label>
          <button
            type="button"
            onClick={() => append({ input: {}, output: {}, description: "" })}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-500/40 bg-indigo-950/40 text-[10px] font-mono text-indigo-300 hover:border-indigo-400 hover:text-white transition-all cursor-pointer"
          >
            <Plus className="h-3 w-3" /> ADD EXAMPLE
          </button>
        </div>

        {fields.length === 0 && (
          <p className="text-[11px] text-slate-500">No examples yet. Add input/output pairs to demonstrate expected behavior.</p>
        )}

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded border border-indigo-900/30 bg-black/40 p-3 space-y-3">
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
            <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-4 space-y-2">
              <label className={`${labelClass} flex items-center gap-1.5`}>
                <Wrench className="h-3.5 w-3.5" /> Allowed Tools * <span className="text-slate-500">(min 1)</span>
              </label>
              <TagsInput
                label=""
                values={field.value ?? []}
                onChange={field.onChange}
                error={fieldMessage(errors.allowedTools)}
                placeholder="e.g. calculator, document_search…"
              />
            </div>
          )}
        />
        <Controller
          control={control}
          name="actionsRequiringApproval"
          render={({ field }) => (
            <div className="rounded border border-indigo-900/40 bg-[#0a0a0a]/60 p-4 space-y-2">
              <label className={`${labelClass} flex items-center gap-1.5`}>
                <CheckSquare className="h-3.5 w-3.5" /> Actions Requiring Approval
              </label>
              <TagsInput
                label=""
                values={field.value ?? []}
                onChange={field.onChange}
                placeholder="e.g. mock_task_creator…"
              />
            </div>
          )}
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
      <div className="flex justify-end pt-2 border-t border-indigo-950/60">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-3 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {mode === "create" ? "[ CREATE SKILL ]" : "[ SAVE DRAFT ]"}
        </button>
      </div>
    </form>
  );
}
