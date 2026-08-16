import { describe, it, expect } from "vitest";
import { isValidIsoDate, formatDate } from "@/lib/api/dates";

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

describe("formatDate (human-readable date display)", () => {
  it("formats valid ISO dates", () => {
    const formatted = formatDate("2026-08-16T12:00:00Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("Aug");
  });

  it("handles null, undefined, or invalid gracefully", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});

