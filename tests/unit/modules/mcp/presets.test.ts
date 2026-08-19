import { describe, it, expect } from "vitest";
import { MCP_PRESETS, findMcpPreset, resolvePresetHeaders } from "@/modules/mcp/presets";

describe("MCP_PRESETS", () => {
  it("covers the core ecosystem servers (data, web, productivity, reasoning, browser, devops)", () => {
    const ids = MCP_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "github",
        "git",
        "postgres",
        "sqlite",
        "memory",
        "webfetch",
        "fetch",
        "brave",
        "playwright",
        "puppeteer",
        "sequential-thinking",
        "everything",
        "filesystem",
        "slack",
        "notion",
        "linear",
        "docker",
        "sentry",
        "arxiv",
        "youtube-transcript",
        "google-maps",
        "time",
      ])
    );
    expect(MCP_PRESETS).toHaveLength(22);
  });

  it("every preset has a unique id, a name, a category, and a valid transport + connection config", () => {
    const ids = new Set<string>();
    for (const preset of MCP_PRESETS) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.category).toBeDefined();
      expect(["SSE", "STDIO"]).toContain(preset.transport);
      if (preset.transport === "SSE") {
        expect(preset.endpointUrl).toMatch(/^https?:\/\//);
      } else {
        expect(preset.command).toMatch(/^npx -y /);
      }
    }
  });

  it("marks token-requiring presets and template placeholders without leaking them", () => {
    const github = findMcpPreset("github")!;
    expect(github.requiresAuthToken).toBe(true);
    expect(github.headers?.Authorization).toBe("Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}");

    // A resolved header substitutes the token...
    expect(resolvePresetHeaders(github, "ghp_123")?.Authorization).toBe("Bearer ghp_123");
    // ...and a missing token drops the placeholder header entirely (never persists "${TOKEN}").
    expect(resolvePresetHeaders(github)).toBeUndefined();
    // Static headers (no placeholder) pass through.
    expect(resolvePresetHeaders(findMcpPreset("postgres")!)).toBeUndefined();

    const notion = findMcpPreset("notion")!;
    expect(notion.requiresAuthToken).toBe(true);
    expect(resolvePresetHeaders(notion, "secret_abc")?.Authorization).toBe("Bearer secret_abc");

    const gmaps = findMcpPreset("google-maps")!;
    expect(gmaps.requiresAuthToken).toBe(true);
    expect(resolvePresetHeaders(gmaps, "AIzaSy_123")?.["X-Goog-Api-Key"]).toBe("AIzaSy_123");
  });

  it("zero-auth stdio presets do not require auth tokens", () => {
    for (const id of [
      "postgres",
      "sqlite",
      "filesystem",
      "slack",
      "memory",
      "git",
      "fetch",
      "playwright",
      "puppeteer",
      "sequential-thinking",
      "everything",
      "docker",
      "arxiv",
      "youtube-transcript",
      "time",
    ]) {
      expect(findMcpPreset(id)!.requiresAuthToken).toBe(false);
    }
  });
});
