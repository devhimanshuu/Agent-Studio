import React from "react";
import Link from "next/link";
import {
  Wrench,
  Calculator,
  Search,
  Database,
  ClipboardList,
  ShieldCheck,
  Lock,
  ArrowUpRight,
  Layers,
  Activity,
  Plug,
  Server,
} from "lucide-react";
import { ToolDefinitionRepository } from "@/repositories/ToolDefinitionRepository";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { createToolRegistry, TOOL_CATEGORIES, getToolCategory } from "@/modules/tools";
import { probeHealth } from "@/lib/tools";
import { ToolCategory, ToolDefinitionDTO } from "@/types/tool";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Reveal } from "@/components/Reveal";
import { clsx } from "clsx";
import { McpServerHub } from "./mcp/McpServerHub";

const pad = (n: number) => String(n).padStart(2, "0");

const DEFAULT_CATEGORY_THEME = {
  icon: Wrench,
  chip: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold",
  header: "border-indigo-300 dark:border-indigo-500/40",
  text: "text-indigo-700 dark:text-indigo-400 font-semibold",
  cardHover: "hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-indigo-500/10",
};

const categoryTheme: Record<
  ToolCategory,
  { icon: typeof Calculator; chip: string; header: string; text: string; cardHover: string }
> = {
  COMPUTE: {
    icon: Calculator,
    chip: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold",
    header: "border-indigo-300 dark:border-indigo-500/40",
    text: "text-indigo-700 dark:text-indigo-400 font-semibold",
    cardHover: "hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-indigo-500/10",
  },
  SEARCH: {
    icon: Search,
    chip: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold",
    header: "border-emerald-300 dark:border-emerald-500/40",
    text: "text-emerald-700 dark:text-emerald-400 font-semibold",
    cardHover: "hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-emerald-500/10",
  },
  DATA: {
    icon: Database,
    chip: "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-semibold",
    header: "border-sky-300 dark:border-sky-500/40",
    text: "text-sky-700 dark:text-sky-400 font-semibold",
    cardHover: "hover:border-sky-400 dark:hover:border-sky-500/50 hover:shadow-sky-500/10",
  },
  TASK: {
    icon: ClipboardList,
    chip: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold",
    header: "border-amber-300 dark:border-amber-500/40",
    text: "text-amber-700 dark:text-amber-400 font-semibold",
    cardHover: "hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-amber-500/10",
  },
};

const healthStyles: Record<string, string> = {
  healthy: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 font-semibold",
  degraded: "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 font-semibold",
  unavailable: "text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 font-semibold",
};

const healthDot: Record<string, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  unavailable: "bg-red-500",
};

export default async function ToolsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab === "mcp" ? "mcp" : "tools";
  const activeCategory = (params.category as ToolCategory) || undefined;

  const definitionRepo = new ToolDefinitionRepository();
  const executionRepo = new ExecutionRepository();
  const registry = createToolRegistry();

  const [definitions, usageCounts, healthList] = await Promise.all([
    definitionRepo.list(),
    executionRepo.countToolCallsByTool(),
    Promise.all(
      registry.listTools().map(async (tool) => {
        const probe = await probeHealth(tool);
        return { toolName: tool.name, ...probe };
      })
    ),
  ]);

  const health = new Map(healthList.map((h) => [h.toolName, h]));

  const categoryCounts: Record<string, number> = {};
  for (const cat of TOOL_CATEGORIES) {
    categoryCounts[cat.id] = definitions.filter((d) => d.category === cat.id).length;
  }

  const byCategory = new Map<ToolCategory, ToolDefinitionDTO[]>();
  for (const def of definitions) {
    if (!def.category) continue;
    const list = byCategory.get(def.category) ?? [];
    list.push(def);
    byCategory.set(def.category, list);
  }

  const visibleCategories = activeCategory
    ? TOOL_CATEGORIES.filter((c) => c.id === activeCategory)
    : TOOL_CATEGORIES;

  const totalUsage = Object.values(usageCounts).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-indigo-950/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-pixel text-pixel-glow uppercase tracking-wide flex items-center gap-3">
            <Wrench className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            TOOL REGISTRY
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
            System tool definitions with strict schema validation, single-use HITL approval locks, health telemetry, and the MCP Server Hub.
          </p>
        </div>
        <Reveal delay={100}>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-700 dark:text-slate-400 px-3 py-2 rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 shadow-sm font-semibold">
            <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            {pad(TOOL_CATEGORIES.length)} CATEGORIES · {pad(registry.listTools().length)} TOOLS · {pad(totalUsage)} CALLS
          </div>
        </Reveal>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1.5 font-mono border-b border-slate-200 dark:border-indigo-950/60 pb-px">
        <Link
          href="/dashboard/tools"
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-t border text-[10px] uppercase tracking-wider transition-all font-semibold",
            activeTab === "tools"
              ? "border-b-0 border-indigo-400 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          )}
        >
          <Wrench className="h-3.5 w-3.5" />
          PERMITTED TOOLS MATRIX
        </Link>
        <Link
          href="/dashboard/tools?tab=mcp"
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-t border text-[10px] uppercase tracking-wider transition-all font-semibold",
            activeTab === "mcp"
              ? "border-b-0 border-indigo-400 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          )}
        >
          <Plug className="h-3.5 w-3.5" />
          MCP SERVER HUB
        </Link>
      </div>

      {activeTab === "mcp" ? (
        <McpServerHub />
      ) : (
      <>
      {/* Matrix header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-mono font-semibold uppercase tracking-widest text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
            <Server className="h-4 w-4" />
            PERMITTED TOOLS MATRIX
          </h2>
          <p className="text-[10px] font-mono text-slate-600 dark:text-slate-500 mt-0.5 font-medium">
            Built-in system tools — schema-validated, permission-gated, and health-probed.
          </p>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 font-mono">
        <Link
          href="/dashboard/tools"
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] uppercase tracking-wider transition-all font-semibold",
            !activeCategory
              ? "border-indigo-400 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
              : "border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-[#0a0a0a]/60 text-slate-700 dark:text-slate-400 hover:border-indigo-400"
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
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] uppercase tracking-wider transition-all font-semibold",
                active
                  ? "border-indigo-400 bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                  : clsx("bg-white dark:bg-[#0a0a0a]/60", theme.chip)
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
          icon={<Wrench className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
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
                      <span className={clsx("p-2 rounded border shadow-sm", theme.chip)}>
                        <theme.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className={clsx("text-sm font-mono font-semibold uppercase tracking-widest", theme.text)}>
                          {categoryMeta.label}
                        </h2>
                        <p className="text-[10px] font-mono text-slate-600 dark:text-slate-500 font-medium">{categoryMeta.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-600 dark:text-slate-500 font-medium">
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
                            "block h-full rounded border border-slate-200 dark:border-indigo-900/50 bg-white/80 dark:bg-[#0a0a0a]/80 p-5 space-y-3 hover:-translate-y-1 shadow-sm hover:shadow-lg transition-all duration-300",
                            theme.cardHover
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono truncate">{definition.displayName}</h3>
                              <p className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400/80 truncate font-medium">{definition.name}</p>
                            </div>
                            <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          </div>

                          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono leading-relaxed line-clamp-2">{definition.description}</p>

                          <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono pt-1">
                            <span className={clsx("px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold", theme.chip)}>
                              {cat.label}
                            </span>
                            <span
                              className={clsx(
                                "px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold",
                                definition.type === "WRITE"
                                  ? "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                                  : "border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300"
                              )}
                            >
                              {definition.type}
                            </span>
                            {definition.requiresApproval && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 uppercase tracking-wider font-semibold">
                                <Lock className="h-2.5 w-2.5" /> HITL
                              </span>
                            )}
                            {tool?.enabled === false && (
                              <span className="px-1.5 py-0.5 rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 uppercase tracking-wider font-semibold">
                                DISABLED
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-indigo-950/60 text-[10px] font-mono">
                            {probe ? (
                              <span
                                className={clsx(
                                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border uppercase tracking-wider font-semibold",
                                  healthStyles[probe.status] ?? healthStyles.unavailable
                                )}
                              >
                                <span className={clsx("h-1.5 w-1.5 rounded-full animate-pulse", healthDot[probe.status] ?? healthDot.unavailable)} />
                                {probe.status}
                              </span>
                            ) : (
                              <span className="text-slate-500">NO PROBE</span>
                            )}
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
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
      </>
      )}
    </div>
  );
}
