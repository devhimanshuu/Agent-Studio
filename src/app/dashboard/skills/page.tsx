"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Copy,
  Archive,
  Trash2,
  Sparkles,
  GitCompare,
  ArrowRight,
  Workflow,
  Zap,
  Play,
  Package,
  Wand2,
} from "lucide-react";
import { skillsApi } from "@/lib/api/skills";
import { SkillDTO, SkillStatus } from "@/types/skill";
import { StatusBadge } from "@/components/skills/StatusBadge";
import { WorkflowStepChain } from "@/components/workflows/WorkflowStepChain";
import { WORKFLOW_TEMPLATES } from "@/components/workflows/WorkflowTemplates";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { SkeletonGrid } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "@/stores/toastStore";
import { clsx } from "clsx";
import { ItemIcon } from "@/components/common/ItemIcon";
import { SkillsMarketplace } from "./marketplace/SkillsMarketplace";
import { UnifiedWorkflowsMarketplace } from "./marketplace/UnifiedWorkflowsMarketplace";
import { N8nWorkflowsMarketplace } from "./marketplace/N8nWorkflowsMarketplace";
import { DifyWorkflowsMarketplace } from "./marketplace/DifyWorkflowsMarketplace";
import { SkillPackMarketplace } from "./packs/SkillPackMarketplace";
import { SkillSynthesizer } from "./synthesizer/SkillSynthesizer";

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
  const [typeFilter, setTypeFilter] = useState<"ALL" | "WORKFLOWS" | "PROMPT">("ALL");
  const [sort, setSort] = useState("updatedAt-desc");
  const [viewMode, setViewMode] = useState<"studio" | "workflows" | "marketplace" | "n8n" | "dify" | "packs" | "synthesize">("studio");
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

  const allSkills = data?.items ?? [];

  // Filter based on typeFilter
  const filteredSkills = allSkills.filter((skill) => {
    const version = skill.publishedVersion ?? skill.currentDraft;
    const isMultiStep = (version?.allowedTools?.length ?? 0) > 1;
    if (typeFilter === "WORKFLOWS") return isMultiStep;
    if (typeFilter === "PROMPT") return !isMultiStep;
    return true;
  });

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-lg sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">
              WORKFLOW & SKILLS STUDIO
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
            Define, validate, version, and execute bounded multi-step workflows & AI skills.
          </p>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setViewMode("studio")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
                viewMode === "studio"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Workflow className="h-3.5 w-3.5" /> MY STUDIO
            </button>
            <button
              type="button"
              onClick={() => setViewMode("marketplace")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer relative",
                viewMode === "marketplace"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              SKILLS MARKETPLACE
            </button>
            <button
              type="button"
              onClick={() => setViewMode("workflows")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer relative",
                viewMode === "workflows"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Workflow className="h-3.5 w-3.5 text-indigo-400" />
              WORKFLOWS MARKETPLACE
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[7px] bg-gradient-to-r from-rose-500 via-blue-500 to-indigo-500 text-white font-extrabold uppercase shadow-xs">
                11.9K+
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("packs")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
                viewMode === "packs"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Package className="h-3.5 w-3.5" />
              1-CLICK PACKS
            </button>
            <button
              type="button"
              onClick={() => setViewMode("synthesize")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
                viewMode === "synthesize"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-indigo-950/40"
              )}
            >
              <Wand2 className="h-3.5 w-3.5" />
              SYNTHESIZE
            </button>
          </div>
        </div>
        <Link
          href="/dashboard/skills/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-indigo-400 bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all text-xs font-mono cursor-pointer w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          CREATE WORKFLOW / SKILL
        </Link>
      </div>

      {/* Marketplace View */}
      {viewMode === "synthesize" ? (
        <SkillSynthesizer />
      ) : viewMode === "packs" ? (
        <SkillPackMarketplace />
      ) : viewMode === "marketplace" ? (
        <SkillsMarketplace />
      ) : viewMode === "workflows" ? (
        <UnifiedWorkflowsMarketplace />
      ) : viewMode === "n8n" ? (
        <N8nWorkflowsMarketplace />
      ) : viewMode === "dify" ? (
        <DifyWorkflowsMarketplace />
      ) : (
        <>
          {/* ENTERPRISE BLUEPRINTS & TEMPLATES */}
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400/80 uppercase tracking-widest font-semibold">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                ENTERPRISE WORKFLOW BLUEPRINTS
              </span>
              <span className="text-[10px] text-slate-500">1-CLICK STARTERS</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {WORKFLOW_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-4 rounded border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/80 space-y-3 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-700/50 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
                        {tmpl.badge}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase">{tmpl.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ItemIcon
                        name={tmpl.name}
                        category={tmpl.category}
                        size="xs"
                      />
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{tmpl.name}</h3>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-serif leading-relaxed line-clamp-2">
                      {tmpl.purpose}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {tmpl.allowedTools.length + 1} steps
                    </span>
                    <Link
                      href={`/dashboard/skills/new?template=${tmpl.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                    >
                      USE BLUEPRINT <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Toolbar: Filter Pills, Search, Status & Sort */}
          <div className="space-y-3 font-mono">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "ALL", label: "ALL CAPABILITIES" },
                { id: "WORKFLOWS", label: "BOUNDED WORKFLOWS" },
                { id: "PROMPT", label: "PROMPT SKILLS" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id as typeof typeFilter)}
                  className={clsx(
                    "px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer border",
                    typeFilter === tab.id
                      ? "border-indigo-400 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 font-bold shadow-sm"
                      : "border-slate-200 dark:border-indigo-900/30 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-indigo-800"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600 dark:text-indigo-400/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="[ SEARCH WORKFLOWS & SKILLS ]"
                  className="w-full rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-colors shadow-sm"
                />
              </div>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SkillStatus | "")}
                className="rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer shadow-sm"
              >
                <option value="">ALL STATUSES</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded border border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer shadow-sm"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Grid */}
          {isLoading ? (
            <SkeletonGrid cards={6} />
          ) : isError ? (
            <EmptyState
              title="Failed to load studio items"
              description="There was an error fetching your workflows and skills. Please try again."
              action={
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 cursor-pointer"
                >
                  [ RETRY ]
                </button>
              }
            />
          ) : filteredSkills.length === 0 ? (
            <EmptyState
              icon={<Workflow className="h-6 w-6" />}
              title={debouncedSearch || status ? "No matching items" : "No items yet"}
              description={
                debouncedSearch || status
                  ? "No workflows or skills match your active filter criteria."
                  : "Create your first bounded multi-step workflow or start from a pre-built blueprint."
              }
              action={
                !debouncedSearch && !status ? (
                  <Link
                    href="/dashboard/skills/new"
                    className="px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-xs font-mono font-semibold hover:bg-indigo-500 transition-all cursor-pointer"
                  >
                    [ CREATE FIRST ITEM ]
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 font-mono">
              {filteredSkills.map((skill) => {
                const version = skill.publishedVersion ?? skill.currentDraft;
                const allowedTools = version?.allowedTools ?? [];
                const actionsRequiringApproval = version?.actionsRequiringApproval ?? [];
                const isWorkflow = allowedTools.length > 1;

                return (
                  <div
                    key={skill.id}
                    className="rounded border border-slate-200 dark:border-indigo-900/50 bg-white/90 dark:bg-[#0a0a0a]/90 p-5 space-y-4 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col justify-between shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <ItemIcon
                              name={skill.name}
                              size="xs"
                            />
                            {isWorkflow ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-900/40">
                                WORKFLOW
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-medium">
                                SKILL
                              </span>
                            )}
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {skill.name}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-serif line-clamp-2 leading-relaxed">
                            {skill.purpose}
                          </p>
                        </div>
                        <StatusBadge status={skill.status} />
                      </div>

                      {/* Visual Step Chain */}
                      {allowedTools.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 space-y-1">
                          <div className="text-[9px] uppercase tracking-wider text-indigo-700 dark:text-indigo-400/80 font-bold">
                            STEP PIPELINE ({allowedTools.length + 1} steps)
                          </div>
                          <WorkflowStepChain
                            allowedTools={allowedTools}
                            actionsRequiringApproval={actionsRequiringApproval}
                            compact
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1 font-medium">
                          <GitCompare className="h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
                          v{skill.currentDraft?.versionNumber ?? skill.publishedVersion?.versionNumber ?? 1}
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <Sparkles className="h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
                          {skill.versions?.length ?? 0} versions
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-3 border-t border-slate-100 dark:border-indigo-950/60 mt-auto">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/dashboard/skills/${skill.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-indigo-400/80 bg-indigo-600 text-white text-xs hover:bg-indigo-500 font-bold shadow-sm transition-all"
                        >
                          <Play className="h-3 w-3" /> [ RUN ]
                        </Link>
                        <Link
                          href={`/dashboard/skills/${skill.id}/edit`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-indigo-900/60 bg-slate-50 dark:bg-indigo-950/30 text-xs text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all"
                        >
                          EDIT
                        </Link>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateMutation.mutate(skill.id)}
                          disabled={duplicateMutation.isPending}
                          title="Duplicate"
                          className="p-1.5 rounded border border-slate-200 dark:border-indigo-900/40 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-400 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {skill.status !== "ARCHIVED" && (
                          <button
                            type="button"
                            onClick={() => setTarget({ skill, action: "archive" })}
                            title="Archive"
                            className="p-1.5 rounded border border-slate-200 dark:border-indigo-900/40 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 hover:border-amber-400 transition-colors cursor-pointer"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {skill.status !== "PUBLISHED" && (
                          <button
                            type="button"
                            onClick={() => setTarget({ skill, action: "delete" })}
                            title="Delete"
                            className="p-1.5 rounded border border-slate-200 dark:border-red-900/40 text-slate-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:border-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
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
