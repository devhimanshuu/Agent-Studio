"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Search, Copy, Archive, Trash2, Sparkles, GitCompare, ArrowUpRight } from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { SkillDTO, SkillStatus } from "@/types/skill";
import { StatusBadge } from "@/components/skills/StatusBadge";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";
import { clsx } from "clsx";

const sortOptions = [
  { value: "updatedAt-desc", label: "UPDATED · NEWEST" },
  { value: "updatedAt-asc", label: "UPDATED · OLDEST" },
  { value: "name-asc", label: "NAME · A-Z" },
  { value: "name-desc", label: "NAME · Z-A" },
  { value: "createdAt-desc", label: "CREATED · NEWEST" },
];

export default function SkillsDashboardPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<SkillStatus | "">("");
  const [sort, setSort] = useState("updatedAt-desc");
  const debounceTimer = useRef<number | null>(null);

  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [search]);

  const [target, setTarget] = useState<{ skill: SkillDTO; action: "archive" | "delete" } | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  const [sortBy, sortOrder] = sort.split("-") as [string, string];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["skills", debouncedSearch, status, sortBy, sortOrder],
    queryFn: () =>
      skillsApi.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        sortBy: sortBy as "updatedAt" | "name" | "createdAt",
        sortOrder: sortOrder as "asc" | "desc",
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["skills"] });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => skillsApi.duplicate(id),
    onSuccess: () => {
      toast.success("Skill duplicated");
      invalidate();
    },
    onError: (e) => toast.error("Duplicate failed", e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => skillsApi.archive(id),
    onSuccess: () => {
      toast.success("Skill archived");
      setTarget(null);
      invalidate();
    },
    onError: (e) => toast.error("Archive failed", e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => skillsApi.delete(id),
    onSuccess: () => {
      toast.success("Skill deleted");
      setTarget(null);
      invalidate();
    },
    onError: (e) => toast.error("Delete failed", e.message),
  });

  const confirmAction = async () => {
    if (!target) return;
    setIsActionPending(true);
    try {
      if (target.action === "archive") await archiveMutation.mutateAsync(target.skill.id);
      else await deleteMutation.mutateAsync(target.skill.id);
    } finally {
      setIsActionPending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-950/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
            SKILLS REGISTRY
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Create, validate, version, and publish reusable AI skills.
          </p>
        </div>
        <Link
          href="/dashboard/skills/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all text-xs font-mono"
        >
          <Plus className="h-4 w-4" />
          CREATE NEW SKILL
        </Link>
      </div>

      {/* Toolbar: Search / Filter / Sort */}
      <div className="flex flex-col sm:flex-row gap-3 font-mono">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="[ SEARCH SKILLS ]"
            className="w-full rounded border border-indigo-900/50 bg-[#0a0a0a] pl-9 pr-3 py-2 text-xs text-slate-100 font-mono placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none transition-colors"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SkillStatus | "")}
          className="rounded border border-indigo-900/50 bg-[#0a0a0a] px-3 py-2 text-xs text-slate-100 font-mono focus:border-indigo-400 focus:outline-none transition-colors cursor-pointer"
        >
          <option value="">ALL STATUSES</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded border border-indigo-900/50 bg-[#0a0a0a] px-3 py-2 text-xs text-slate-100 font-mono focus:border-indigo-400 focus:outline-none transition-colors cursor-pointer"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <EmptyState
          title="Failed to load skills"
          description="There was an error fetching your skills. Please try again."
          action={
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 cursor-pointer"
            >
              [ RETRY ]
            </button>
          }
        />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title={debouncedSearch || status ? "No matching skills" : "No skills yet"}
          description={
            debouncedSearch || status
              ? "No skills match your search or filter criteria."
              : "Create your first reusable AI Skill with schemas, instructions, and permitted tools."
          }
          action={
            !debouncedSearch && !status ? (
              <Link
                href="/dashboard/skills/new"
                className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all"
              >
                [ CREATE FIRST SKILL ]
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {data?.items.map((skill) => (
            <div
              key={skill.id}
              className="rounded border border-indigo-900/50 bg-[#0a0a0a]/80 p-5 space-y-3 hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-100 font-mono truncate">{skill.name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono line-clamp-2">{skill.purpose}</p>
                </div>
                <StatusBadge status={skill.status} />
              </div>

              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <GitCompare className="h-3 w-3 text-indigo-400/70" />
                  v{skill.currentDraft?.versionNumber ?? skill.publishedVersion?.versionNumber ?? 1}
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-indigo-400/70" />
                  {skill.versions?.length ?? 0} versions
                </span>
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-indigo-950/60 mt-auto">
                <Link
                  href={`/dashboard/skills/${skill.id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-indigo-500/40 bg-indigo-950/40 text-[10px] font-mono text-indigo-300 hover:border-indigo-400 hover:text-white transition-all"
                >
                  OPEN <ArrowUpRight className="h-3 w-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => duplicateMutation.mutate(skill.id)}
                  disabled={duplicateMutation.isPending}
                  title="Duplicate skill"
                  className="p-1.5 rounded border border-indigo-900/40 text-slate-500 hover:text-indigo-300 hover:border-indigo-500/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {skill.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    onClick={() => setTarget({ skill, action: "archive" })}
                    title="Archive skill"
                    className="p-1.5 rounded border border-indigo-900/40 text-slate-500 hover:text-amber-300 hover:border-amber-500/40 transition-all cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                )}
                {skill.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => setTarget({ skill, action: "delete" })}
                    title="Delete skill"
                    className="p-1.5 rounded border border-indigo-900/40 text-slate-500 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={target !== null}
        title={target?.action === "archive" ? "ARCHIVE SKILL" : "DELETE SKILL"}
        description={
          target?.action === "archive"
            ? `Archive "${target?.skill.name}"? It will be hidden from active lists but preserved.`
            : `Delete "${target?.skill.name}"? This permanently removes the draft and cannot be undone.`
        }
        confirmLabel={target?.action === "archive" ? "ARCHIVE" : "DELETE"}
        variant={target?.action === "archive" ? "warning" : "danger"}
        isPending={isActionPending}
        onConfirm={confirmAction}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
