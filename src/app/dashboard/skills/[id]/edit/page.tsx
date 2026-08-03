"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, GitBranch } from "lucide-react";
import { SkillForm } from "@/components/skills/SkillForm";
import { skillsApi } from "@/lib/api/skills";
import { SkeletonSkillForm } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";

export default function EditSkillPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: skill, isLoading, isError } = useQuery({
    queryKey: ["skill", id],
    queryFn: () => skillsApi.get(id),
  });

  if (isLoading) return <SkeletonSkillForm />;
  if (isError || !skill) {
    return (
      <EmptyState
        title="Skill not found"
        description="This skill does not exist or you do not have access to it."
        action={
          <Link
            href="/dashboard/skills"
            className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all"
          >
            [ BACK TO REGISTRY ]
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b border-indigo-950/80 pb-5">
        <Link
          href={`/dashboard/skills/${id}`}
          className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors mb-2"
        >
          <ChevronLeft className="h-3 w-3" /> BACK TO SKILL
        </Link>
        <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">EDIT DRAFT</h1>
        <p className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
          {skill.name}
          {skill.currentDraft && (
            <span className="text-slate-500">· Draft v{skill.currentDraft.versionNumber} ({skill.currentDraft.status})</span>
          )}
          {skill.status === "PUBLISHED" && <span className="text-amber-300">· editing creates a new draft version</span>}
        </p>
      </div>

      <SkillForm
        mode="edit"
        skill={skill}
        initialDraft={skill.currentDraft}
        onSubmit={async (values) => {
          setIsSubmitting(true);
          try {
            const updated = await skillsApi.update(id, values);
            toast.success("Draft saved", `Saved as Draft v${updated.versionNumber}`);
            router.push(`/dashboard/skills/${id}`);
          } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to save draft";
            toast.error("Save failed", message);
            setIsSubmitting(false);
          }
        }}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
