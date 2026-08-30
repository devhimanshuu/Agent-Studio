/**
 * Integration tests for /api/health – exercises the full route handler.
 */
import { describe, it, expect, vi } from "vitest";

// Mock Clerk auth for this test file
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "test-user-123" })),
}));

import { GET } from "@/app/api/health/route";

describe("/api/health – integration", () => {
  it("returns 200 with status ok", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("agent-studio");
    expect(body.timestamp).toBeDefined();
    // timestamp should be a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
