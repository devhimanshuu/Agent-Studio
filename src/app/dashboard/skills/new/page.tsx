"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SkillForm } from "@/components/skills/SkillForm";
import { WORKFLOW_TEMPLATES } from "@/components/workflows/WorkflowTemplates";
import { skillsApi } from "@/lib/api/skills";
import { toast } from "@/stores/toastStore";

function NewSkillContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-indigo-950/80 pb-5">
        <div>
          <Link
            href="/dashboard/skills"
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors mb-2"
          >
            <ChevronLeft className="h-3 w-3" /> BACK TO STUDIO
          </Link>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
            {template ? `BLUEPRINT: ${template.name}` : "NEW WORKFLOW / SKILL"}
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {template ? template.purpose : "Define a schema-validated bounded workflow or reusable AI skill."}
          </p>
        </div>
      </div>

      <SkillForm
        mode="create"
        initialTemplate={template ? {
          name: template.name,
          purpose: template.purpose,
          instructions: template.instructions,
          inputSchema: template.inputSchema,
          outputSchema: template.outputSchema,
          examples: template.examples,
          allowedTools: template.allowedTools,
          actionsRequiringApproval: template.actionsRequiringApproval,
          maxExecutionSteps: template.maxExecutionSteps,
        } : null}
        onSubmit={async (values) => {
          setIsSubmitting(true);
          try {
            const skill = await skillsApi.create(values);
            toast.success("Created successfully", `"${skill.name}" saved as Draft v1`);
            router.push(`/dashboard/skills/${skill.id}`);
          } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to create";
            toast.error("Create failed", message);
            setIsSubmitting(false);
          }
        }}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

export default function NewSkillPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-mono text-slate-400">[ LOADING STUDIO BUILDER... ]</div>}>
      <NewSkillContent />
    </Suspense>
  );
}

