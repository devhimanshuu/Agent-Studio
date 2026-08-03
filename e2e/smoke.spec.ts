import { test, expect } from "@playwright/test";

test.describe("Agent Studio smoke tests", () => {
  test("landing page renders the hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI SKILLS");
    await expect(page.getByText("GET STARTED FREE").first()).toBeVisible();
  });

  test("health endpoint reports ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("agent-studio");
  });

  test("unknown route renders the 404 page", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("NOT FOUND");
  });
});
