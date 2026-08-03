import { describe, it, expect } from "vitest";
import { recordLookupTool } from "@/modules/tools";

interface LookupOutput {
  entity: string;
  query: string;
  count: number;
  records: Record<string, unknown>[];
}

async function lookup(input: Record<string, unknown>): Promise<LookupOutput> {
  return (await recordLookupTool.execute(input)) as LookupOutput;
}

describe("Record Lookup tool", () => {
  it("returns all records for an entity with no filter", async () => {
    const output = await lookup({ entity: "banks" });
    expect(output.entity).toBe("banks");
    expect(output.count).toBeGreaterThan(0);
    expect(output.records[0]).toHaveProperty("id");
  });

  it("finds a record by exact id", async () => {
    const output = await lookup({ entity: "employees", id: "EMP-001" });
    expect(output.count).toBe(1);
    expect(output.records[0]).toMatchObject({ id: "EMP-001", name: "Ada Lovelace" });
  });

  it("id match is case-insensitive", async () => {
    const output = await lookup({ entity: "employees", id: "emp-002" });
    expect(output.records[0]).toMatchObject({ id: "EMP-002" });
  });

  it("searches across string fields", async () => {
    const output = await lookup({ entity: "customers", search: "acme" });
    expect(output.records.map((r) => r.name)).toContain("Acme Corp");
  });

  it("returns empty records for a missing id", async () => {
    const output = await lookup({ entity: "orders", id: "ORD-999" });
    expect(output.count).toBe(0);
    expect(output.records).toEqual([]);
  });

  it("rejects unknown entities", async () => {
    const issues = recordLookupTool.validate({ entity: "planets" });
    expect(issues.join(" ")).toMatch(/Unknown record entity/);
  });

  it("respects the result limit", async () => {
    const output = await lookup({ entity: "employees", limit: 1 });
    expect(output.count).toBe(1);
  });

  it("reports healthy", async () => {
    await expect(recordLookupTool.healthCheck()).resolves.toMatchObject({ status: "healthy" });
  });
});
