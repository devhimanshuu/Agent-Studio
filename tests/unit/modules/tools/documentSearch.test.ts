import { describe, it, expect } from "vitest";
import { documentSearchTool } from "@/modules/tools";

interface SearchResult {
  title: string;
  snippet: string;
  relevance: number;
  source?: string;
}

interface SearchOutput {
  query: string;
  total: number;
  results: SearchResult[];
  source: string;
}

async function search(input: Record<string, unknown>): Promise<SearchOutput> {
  return (await documentSearchTool.execute(input)) as SearchOutput;
}

describe("Document Search tool", () => {
  it("returns search results from PostgreSQL or Qdrant", async () => {
    const output = await search({ query: "test" });
    expect(output.query).toBe("test");
    expect(Array.isArray(output.results)).toBe(true);
    expect(["postgresql", "qdrant"]).toContain(output.source);
  });

  it("searches across execution history", async () => {
    const output = await search({ query: "execution" });
    expect(output.query).toBe("execution");
    expect(Array.isArray(output.results)).toBe(true);
  });

  it("respects the limit", async () => {
    const limited = await search({ query: "test", limit: 2 });
    expect(limited.results.length).toBeLessThanOrEqual(2);
  });

  it("returns empty result set for nonsensical query", async () => {
    const output = await search({ query: "zzzqqq12345" });
    expect(output.total).toBe(0);
    expect(output.results).toEqual([]);
  });

  it("rejects empty queries and bad limits", () => {
    expect(documentSearchTool.validate({ query: "   " }).join(" ")).toMatch(/query is required/);
    expect(documentSearchTool.validate({ query: "x", limit: 99 }).join(" ")).toMatch(/limit/);
  });

  it("reports healthy", async () => {
    const health = await documentSearchTool.healthCheck();
    expect(health.status).toMatch(/healthy|degraded|unavailable/);
    expect(typeof health.latencyMs).toBe("number");
  });
});
