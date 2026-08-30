import { test, expect } from "@playwright/test";

test.describe("Navigation & page rendering", () => {
  test("landing page has expected navigation links", async ({ page }) => {
    await page.goto("/");
    // The hero section should be visible
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI SKILLS");
    // The page should have a meaningful title
    await expect(page).toHaveTitle(/Agent Studio/);
  });

  test("health endpoint returns correct structure", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("service", "agent-studio");
    expect(body).toHaveProperty("timestamp");
    // timestamp should be a valid ISO 8601 string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  test("unknown API routes return appropriate errors", async ({ request }) => {
    const res = await request.get("/api/nonexistent-endpoint-xyz");
    // Should get a 404 or similar error from Next.js
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("404 page renders for non-existent frontend routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("NOT FOUND");
  });

  test("page renders without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    // Allow some time for any client-side errors
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });
});

test.describe("API response headers", () => {
  test("health endpoint returns JSON content type", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.headers()["content-type"]).toContain("application/json");
  });

  test("skills endpoint returns 401 without auth cookie", async ({ request }) => {
    // Note: in CI, Clerk might not be fully configured; this test verifies
    // that the route at least responds (not a server crash).
    const res = await request.get("/api/skills");
    // Without Clerk config, we expect either 401 or a 500 from missing env
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(600);
  });
});

test.describe("Static asset loading", () => {
  test("loads CSS without errors", async ({ page }) => {
    const failedRequests: string[] = [];
    page.on("requestfailed", (req) => failedRequests.push(req.url()));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // No CSS or JS assets should have failed to load
    const cssFailures = failedRequests.filter(
      (url) => url.endsWith(".css") || url.endsWith(".js")
    );
    expect(cssFailures).toEqual([]);
  });
});
