"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SkillForm } from "@/components/skills/SkillForm";
import { skillsApi } from "@/lib/api/skills";
import { toast } from "@/stores/toastStore";

export default function NewSkillPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-indigo-950/80 pb-5">
        <div>
          <Link
            href="/dashboard/skills"
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors mb-2"
          >
            <ChevronLeft className="h-3 w-3" /> BACK TO REGISTRY
          </Link>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">NEW SKILL</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Define a schema-validated reusable AI skill.
          </p>
        </div>
      </div>

      <SkillForm
        mode="create"
        onSubmit={async (values) => {
          setIsSubmitting(true);
          try {
            const skill = await skillsApi.create(values);
            toast.success("Skill created", `"${skill.name}" saved as Draft v1`);
            router.push(`/dashboard/skills/${skill.id}`);
          } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to create skill";
            toast.error("Create failed", message);
            setIsSubmitting(false);
          }
        }}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
