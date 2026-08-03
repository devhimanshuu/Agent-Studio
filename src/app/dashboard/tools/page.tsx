import React from "react";
import Link from "next/link";
import {
  Wrench,
  ArrowUpRight,
  Activity,
  ShieldCheck,
  Lock,
  Calculator,
  Search,
  Database,
  ClipboardList,
  Layers,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { createToolRegistry, isToolCategory, TOOL_CATEGORIES, getToolCategory } from "@/modules/tools";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { listToolDefinitions, probeHealth } from "@/lib/tools";
import { Reveal } from "@/components/Reveal";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ToolDefinitionDTO, ToolCategory } from "@/types/tool";
import { clsx } from "clsx";

const pad = (n: number) => String(n).padStart(2, "0");

/** Safe fallback so a future taxonomy category without a dedicated palette
 * still renders instead of crashing the dashboard. */
const DEFAULT_CATEGORY_THEME = {
  icon: Wrench,
  chip: "border-slate-500/40 bg-slate-950/40 text-slate-300",
  header: "border-slate-500/40",
  text: "text-slate-400",
  cardHover: "hover:border-slate-500/50 hover:shadow-slate-500/10",
};

/** Category → icon + accent palette. UI concern; the taxonomy (modules/tools)
 * stays UI-agnostic and supplies labels/descriptions/ordering. Adding a new
 * category to TOOL_CATEGORIES is safe — unknown ids fall back to the default
 * palette above. */
const categoryTheme: Record<
  ToolCategory,
  { icon: typeof Calculator; chip: string; header: string; text: string; cardHover: string }
> = {
  COMPUTE: {
    icon: Calculator,
    chip: "border-indigo-500/40 bg-indigo-950/40 text-indigo-300",
    header: "border-indigo-500/40",
    text: "text-indigo-400",
    cardHover: "hover:border-indigo-500/50 hover:shadow-indigo-500/10",
  },
  SEARCH: {
    icon: Search,
    chip: "border-emerald-500/40 bg-emerald-950/40 text-emerald-300",
    header: "border-emerald-500/40",
    text: "text-emerald-400",
    cardHover: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
  },
  DATA: {
    icon: Database,
    chip: "border-sky-500/40 bg-sky-950/40 text-sky-300",
    header: "border-sky-500/40",
    text: "text-sky-400",
    cardHover: "hover:border-sky-500/50 hover:shadow-sky-500/10",
  },
  TASK: {
    icon: ClipboardList,
    chip: "border-amber-500/40 bg-amber-950/40 text-amber-300",
    header: "border-amber-500/40",
    text: "text-amber-400",
    cardHover: "hover:border-amber-500/50 hover:shadow-amber-500/10",
  },
};

const healthStyles: Record<string, string> = {
  healthy: "text-emerald-400 border-emerald-500/40 bg-emerald-950/30",
  degraded: "text-amber-400 border-amber-500/40 bg-amber-950/30",
  unavailable: "text-red-400 border-red-500/40 bg-red-950/30",
};

const healthDot: Record<string, string> = {
  healthy: "bg-emerald-400",
  degraded: "bg-amber-400",
  unavailable: "bg-red-400",
};

export default async function ToolsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { userId } = await auth();
  const { category } = await searchParams;
  // Category-first filtering: ?category=COMPUTE narrows the registry view.
  const activeCategory = isToolCategory(category) ? category : null;

  const registry = createToolRegistry();
  const executionRepo = new ExecutionRepository();
  // Usage counts are scoped to the signed-in user — never aggregate other
  // users' invocations.
  const [definitions, usageCounts] = userId
    ? await Promise.all([listToolDefinitions(), executionRepo.countToolCallsByTool(userId)])
    : [await listToolDefinitions(), {} as Record<string, number>];

  // Probe health for every registered tool (independent, never throws).
  const health = new Map<string, Awaited<ReturnType<typeof probeHealth>>>();
  for (const tool of registry.listTools()) {
    health.set(tool.name, await probeHealth(tool));
  }

  const totalUsage = Object.values(usageCounts).reduce((sum, n) => sum + n, 0);
  const categoryCounts = registry.countToolsByCategory();
  const visibleCategories = TOOL_CATEGORIES.filter((c) => !activeCategory || c.id === activeCategory);

  // Group definitions by their effective category (runtime tool wins, then the
  // DB catalog row, then a safe default).
  const byCategory = new Map<ToolCategory, ToolDefinitionDTO[]>();
  for (const definition of definitions) {
    const tool = registry.getTool(definition.name);
    // Effective category: runtime tool wins, then the DB catalog row, then
    // COMPUTE as the intentional safe default for stale/unmatched rows (a
    // removed tool's catalog row stays grouped rather than disappearing).
    const effective = tool?.category ?? definition.category ?? "COMPUTE";
    const group = byCategory.get(effective) ?? [];
    group.push(definition);
    byCategory.set(effective, group);
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-950/80 pb-6">
        <Reveal delay={0}>
          <div>
            <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide">TOOL REGISTRY</h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              The pluggable tool framework — every tool is categorized at registration and executes through the registry.
            </p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 px-3 py-2 rounded border border-indigo-900/50 bg-[#0a0a0a]/80">
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            {pad(TOOL_CATEGORIES.length)} CATEGORIES · {pad(registry.listTools().length)} TOOLS · {pad(totalUsage)} CALLS
          </div>
        </Reveal>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 font-mono">
        <Link
          href="/dashboard/tools"
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] uppercase tracking-wider transition-all",
            !activeCategory
              ? "border-indigo-400 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
              : "border-indigo-900/50 bg-[#0a0a0a]/60 text-slate-400 hover:border-indigo-400 hover:text-white"
          )}
        >
          ALL · {pad(registry.listTools().length)}
        </Link>
        {TOOL_CATEGORIES.map((c) => {
          const theme = categoryTheme[c.id] ?? DEFAULT_CATEGORY_THEME;
          const active = activeCategory === c.id;
          return (
            <Link
              key={c.id}
              href={`/dashboard/tools?category=${c.id}`}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] uppercase tracking-wider transition-all",
                active
                  ? "border-indigo-400 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : clsx("bg-[#0a0a0a]/60", theme.chip, "hover:brightness-125")
              )}
            >
              <theme.icon className="h-3 w-3" />
              {c.label} · {pad(categoryCounts[c.id])}
            </Link>
          );
        })}
      </div>

      {definitions.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title="No tools registered"
          description="The tool catalog is empty. Built-in tools self-register on first run."
        />
      ) : (
        <div className="space-y-10">
          {visibleCategories.map((cat, catIndex) => {
            const toolsInCategory = byCategory.get(cat.id) ?? [];
            if (toolsInCategory.length === 0) return null;
            const theme = categoryTheme[cat.id] ?? DEFAULT_CATEGORY_THEME;
            const categoryMeta = getToolCategory(cat.id);
            const categoryUsage = toolsInCategory.reduce((sum, d) => sum + (usageCounts[d.name] ?? 0), 0);
            return (
              <section key={cat.id}>
                {/* Category section header */}
                <Reveal delay={catIndex * 40}>
                  <div className={clsx("flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-4", theme.header)}>
                    <div className="flex items-center gap-3">
                      <span className={clsx("p-2 rounded border", theme.chip)}>
                        <theme.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className={clsx("text-sm font-mono font-semibold uppercase tracking-widest", theme.text)}>
                          {categoryMeta.label}
                        </h2>
                        <p className="text-[10px] font-mono text-slate-500">{categoryMeta.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                      <span>{pad(toolsInCategory.length)} TOOLS</span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> {pad(categoryUsage)} CALLS
                      </span>
                    </div>
                  </div>
                </Reveal>

                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {toolsInCategory.map((definition: ToolDefinitionDTO, index: number) => {
                    const tool = registry.getTool(definition.name);
                    const probe = health.get(definition.name);
                    const usage = usageCounts[definition.name] ?? 0;
                    return (
                      <Reveal key={definition.name} delay={index * 60}>
                        <Link
                          href={`/dashboard/tools/${definition.name}?category=${cat.id}`}
                          className={clsx(
                            "block h-full rounded border border-indigo-900/50 bg-[#0a0a0a]/80 p-5 space-y-3 hover:-translate-y-1 hover:shadow-lg transition-all duration-300",
                            theme.cardHover
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <h3 className="text-sm font-semibold text-slate-100 font-mono truncate">{definition.displayName}</h3>
                              <p className="text-[10px] font-mono text-indigo-400/80 truncate">{definition.name}</p>
                            </div>
                            <ArrowUpRight className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          </div>

                          <p className="text-[11px] text-slate-500 font-mono leading-relaxed line-clamp-2">{definition.description}</p>

                          <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono pt-1">
                            <span className={clsx("px-1.5 py-0.5 rounded border uppercase tracking-wider", theme.chip)}>
                              {cat.label}
                            </span>
                            <span
                              className={clsx(
                                "px-1.5 py-0.5 rounded border uppercase tracking-wider",
                                definition.type === "WRITE"
                                  ? "border-amber-500/40 bg-amber-950/40 text-amber-300"
                                  : "border-sky-500/40 bg-sky-950/40 text-sky-300"
                              )}
                            >
                              {definition.type}
                            </span>
                            {definition.requiresApproval && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-950/40 text-amber-300 uppercase tracking-wider">
                                <Lock className="h-2.5 w-2.5" /> HITL
                              </span>
                            )}
                            {tool?.enabled === false && (
                              <span className="px-1.5 py-0.5 rounded border border-red-500/40 bg-red-950/40 text-red-300 uppercase tracking-wider">
                                DISABLED
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-indigo-950/60 text-[10px] font-mono">
                            {probe ? (
                              <span
                                className={clsx(
                                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border uppercase tracking-wider",
                                  healthStyles[probe.status] ?? healthStyles.unavailable
                                )}
                              >
                                <span className={clsx("h-1.5 w-1.5 rounded-full animate-pulse", healthDot[probe.status] ?? healthDot.unavailable)} />
                                {probe.status}
                              </span>
                            ) : (
                              <span className="text-slate-600">NO PROBE</span>
                            )}
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <Activity className="h-3 w-3" />
                              {pad(usage)} CALLS
                            </span>
                          </div>
                        </Link>
                      </Reveal>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
