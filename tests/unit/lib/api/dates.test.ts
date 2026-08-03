import { describe, it, expect } from "vitest";
import { isValidIsoDate } from "@/lib/api/dates";

describe("isValidIsoDate (query-param date validation)", () => {
  it("accepts full ISO timestamps", () => {
    expect(isValidIsoDate("2026-08-01T10:00:00Z")).toBe(true);
    expect(isValidIsoDate("2026-08-01")).toBe(true);
  });

  it("rejects garbage strings that would become Invalid Date", () => {
    expect(isValidIsoDate("not-a-date")).toBe(false);
    expect(isValidIsoDate("garbage")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});
