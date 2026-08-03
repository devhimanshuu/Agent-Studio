import { describe, it, expect } from "vitest";
import { documentSearchTool } from "@/modules/tools";

interface SearchResult {
  title: string;
  snippet: string;
  relevance: number;
}

interface SearchOutput {
  query: string;
  total: number;
  results: SearchResult[];
}

async function search(input: Record<string, unknown>): Promise<SearchOutput> {
  return (await documentSearchTool.execute(input)) as SearchOutput;
}

describe("Document Search tool", () => {
  it("finds documents by keyword and returns ranked results with snippets", async () => {
    const output = await search({ query: "approval" });
    expect(output.total).toBeGreaterThan(0);
    expect(output.results[0].title).toMatch(/Approval/i);
    expect(output.results[0]).toHaveProperty("snippet");
    expect(output.results[0].relevance).toBeGreaterThan(0);
    expect(output.results[0].relevance).toBeLessThanOrEqual(1);
  });

  it("expands synonyms so 'hitl' surfaces the approvals document", async () => {
    const output = await search({ query: "hitl" });
    expect(output.results.map((r) => r.title)).toContain("Approval Workflow (HITL)");
  });

  it("ranks results by relevance (descending)", async () => {
    const output = await search({ query: "tool registry" });
    const relevances = output.results.map((r) => r.relevance);
    for (let i = 1; i < relevances.length; i += 1) {
      expect(relevances[i]).toBeLessThanOrEqual(relevances[i - 1]);
    }
  });

  it("respects the limit and caps at 10", async () => {
    const limited = await search({ query: "registry", limit: 1 });
    expect(limited.results).toHaveLength(1);
    expect(limited.total).toBeGreaterThanOrEqual(1);
  });

  it("returns an empty result set for an unmatched query", async () => {
    const output = await search({ query: "zzzqqq" });
    expect(output.total).toBe(0);
    expect(output.results).toEqual([]);
  });

  it("rejects empty queries and bad limits", async () => {
    expect(documentSearchTool.validate({ query: "   " }).join(" ")).toMatch(/query is required/);
    expect(documentSearchTool.validate({ query: "x", limit: 99 }).join(" ")).toMatch(/limit/);
  });

  it("reports healthy", async () => {
    await expect(documentSearchTool.healthCheck()).resolves.toMatchObject({ status: "healthy" });
  });
});
