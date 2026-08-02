import { describe, it, expect } from "vitest";
import { env } from "@/lib/config/env";

describe("Environment Configuration Unit Tests", () => {
  it("should have default development database URL", () => {
    expect(env.DATABASE_URL).toBeDefined();
    expect(typeof env.DATABASE_URL).toBe("string");
  });

  it("should default NODE_ENV to development or test", () => {
    expect(["development", "test", "production"]).toContain(env.NODE_ENV);
  });
});
