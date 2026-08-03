import { ToolCategory } from "@/types/tool";

/**
 * Category taxonomy — the single source of truth for how the registry and UI
 * organize tools. Every tool declares exactly one category, and the registry
 * REJECTS tools with an unknown category at registration time (fail-fast, so a
 * typo can never silently create an uncategorized or misgrouped tool).
 *
 * Order matters: `TOOL_CATEGORIES` is the presentation order used by the
 * dashboard, the skill form's tool picker, and any future tool marketplace.
 */
export interface ToolCategoryDef {
  /** Stable id — must be a valid `ToolCategory`. */
  id: ToolCategory;
  /** Human label, e.g. "Compute". */
  label: string;
  /** One-line description shown in category headers. */
  description: string;
  /** Presentation order on the dashboard (ascending). */
  order: number;
}

export const TOOL_CATEGORIES: ToolCategoryDef[] = [
  {
    id: "COMPUTE",
    label: "Compute",
    description: "Deterministic math, transformation, and analysis primitives.",
    order: 1,
  },
  {
    id: "SEARCH",
    label: "Search",
    description: "Knowledge retrieval and discovery over indexed sources.",
    order: 2,
  },
  {
    id: "DATA",
    label: "Data",
    description: "Structured record access — lookups, entities, and reports.",
    order: 3,
  },
  {
    id: "TASK",
    label: "Tasks",
    description: "State-changing actions (WRITE) that require human approval.",
    order: 4,
  },
];

/** Narrow a raw string to a ToolCategory. */
export function isToolCategory(value: unknown): value is ToolCategory {
  return (
    typeof value === "string" && TOOL_CATEGORIES.some((c) => c.id === (value as ToolCategory))
  );
}

/** Category definition by id — throws for an unknown id (programmer error). */
export function getToolCategory(id: ToolCategory): ToolCategoryDef {
  const def = TOOL_CATEGORIES.find((c) => c.id === id);
  if (!def) {
    throw new Error(`Unknown tool category "${id}". Add it to TOOL_CATEGORIES in modules/tools/categories.ts`);
  }
  return def;
}

/** Category label for display; falls back to the raw id for unknown values. */
export function toolCategoryLabel(id: ToolCategory | string): string {
  if (isToolCategory(id)) return getToolCategory(id).label;
  return id;
}
