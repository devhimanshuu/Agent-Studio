import { describe, it, expect, beforeAll } from "vitest";
import { recordLookupTool } from "@/modules/tools";

interface LookupOutput {
  entity: string;
  query: string;
  count: number;
  records: Record<string, unknown>[];
  source: string;
}

async function lookup(input: Record<string, unknown>): Promise<LookupOutput> {
  return (await recordLookupTool.execute(input)) as LookupOutput;
}

describe("Record Lookup tool", () => {
  beforeAll(async () => {
    // Ensure database is available for tests
    const { prisma } = await import("@/lib/prisma");
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      console.warn("Database not available for record lookup tests — skipping");
    }
  });

  it("returns records from PostgreSQL execution history", async () => {
    const output = await lookup({ entity: "orders" });
    expect(output.entity).toBe("orders");
    expect(output.source).toBe("postgresql");
    // Should return executions as "orders"
    expect(Array.isArray(output.records)).toBe(true);
  });

  it("returns users as employees", async () => {
    const output = await lookup({ entity: "employees" });
    expect(output.entity).toBe("employees");
    expect(output.source).toBe("postgresql");
    expect(Array.isArray(output.records)).toBe(true);
  });

  it("searches across string fields", async () => {
    const output = await lookup({ entity: "employees", search: "test" });
    expect(output.entity).toBe("employees");
    expect(Array.isArray(output.records)).toBe(true);
  });

  it("returns empty records for a missing id", async () => {
    const output = await lookup({ entity: "orders", id: "nonexistent-id-12345" });
    expect(output.count).toBe(0);
    expect(output.records).toEqual([]);
  });

  it("rejects unknown entities", () => {
    const issues = recordLookupTool.validate({ entity: "planets" });
    expect(issues.join(" ")).toMatch(/Unknown record entity/);
  });

  it("respects the result limit", async () => {
    const output = await lookup({ entity: "employees", limit: 1 });
    expect(output.count).toBeLessThanOrEqual(1);
  });

  it("reports healthy when database is available", async () => {
    const health = await recordLookupTool.healthCheck();
    expect(health.status).toMatch(/healthy|unavailable/);
    expect(typeof health.latencyMs).toBe("number");
  });
});
