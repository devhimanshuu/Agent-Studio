import { describe, it, expect } from "vitest";
import {
  ToolRegistry,
  createToolRegistry,
  TOOL_CATEGORIES,
  getToolCategory,
  isToolCategory,
  toolCategoryLabel,
} from "@/modules/tools";
import { makeTool } from "./helpers/makeTool";

describe("Category taxonomy", () => {
  it("defines every category in presentation order with metadata", () => {
    expect(TOOL_CATEGORIES.map((c) => c.id)).toEqual(["COMPUTE", "SEARCH", "DATA", "TASK"]);
    for (const cat of TOOL_CATEGORIES) {
      expect(cat.label.length).toBeGreaterThan(0);
      expect(cat.description.length).toBeGreaterThan(0);
      expect(cat.order).toBeTypeOf("number");
    }
  });

  it("narrows raw strings and labels them", () => {
    expect(isToolCategory("COMPUTE")).toBe(true);
    expect(isToolCategory("compute")).toBe(false); // case-sensitive on purpose
    expect(isToolCategory("PLANET")).toBe(false);
    expect(isToolCategory(42)).toBe(false);
    expect(toolCategoryLabel("SEARCH")).toBe("Search");
    expect(toolCategoryLabel("PLANET")).toBe("PLANET"); // graceful fallback
  });

  it("getToolCategory returns metadata and throws for unknown ids", () => {
    expect(getToolCategory("TASK")).toMatchObject({ label: "Tasks" });
    expect(() => getToolCategory("PLANET" as never)).toThrow(/Unknown tool category/);
  });
});

describe("Category-first ToolRegistry", () => {
  it("rejects registration of a tool with an unknown category (fail-fast)", () => {
    const registry = new ToolRegistry();
    expect(() => registry.registerTool(makeTool({ name: "rogue", category: "PLANET" as never }))).toThrow(
      /unknown category "PLANET"/
    );
  });

  it("listCategories returns the taxonomy in presentation order", () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool({ name: "alpha", category: "DATA" }));
    expect(registry.listCategories()).toEqual(TOOL_CATEGORIES);
  });

  it("groups tools by category", () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool({ name: "calc", category: "COMPUTE" }));
    registry.registerTool(makeTool({ name: "search", category: "SEARCH" }));
    registry.registerTool(makeTool({ name: "lookup", category: "DATA" }));

    expect(registry.getToolsByCategory("COMPUTE").map((t) => t.name)).toEqual(["calc"]);
    expect(registry.getToolsByCategory("SEARCH").map((t) => t.name)).toEqual(["search"]);
    expect(registry.getToolsByCategory("DATA").map((t) => t.name)).toEqual(["lookup"]);
    expect(registry.getToolsByCategory("TASK")).toEqual([]);
  });

  it("counts tools per category", () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool({ name: "a", category: "COMPUTE" }));
    registry.registerTool(makeTool({ name: "b", category: "COMPUTE" }));
    registry.registerTool(makeTool({ name: "c", category: "TASK" }));

    const counts = registry.countToolsByCategory();
    expect(counts).toMatchObject({ COMPUTE: 2, SEARCH: 0, DATA: 0, TASK: 1 });
  });

  it("the built-in registry covers every category exactly once", () => {
    const registry = createToolRegistry();
    expect(registry.countToolsByCategory()).toEqual({ COMPUTE: 1, SEARCH: 1, DATA: 1, TASK: 1 });
  });
});
