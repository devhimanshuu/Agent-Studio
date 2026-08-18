import { describe, it, expect } from "vitest";
import { MCP_PRESETS, findMcpPreset, resolvePresetHeaders } from "@/modules/mcp/presets";

describe("MCP_PRESETS", () => {
  it("covers the core ecosystem servers (data, web, productivity)", () => {
    const ids = MCP_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["github", "postgres", "sqlite", "webfetch", "brave", "filesystem", "slack", "memory"])
    );
    expect(MCP_PRESETS).toHaveLength(8);
  });

  it("every preset has a unique id, a name, and a valid transport + connection config", () => {
    const ids = new Set<string>();
    for (const preset of MCP_PRESETS) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      expect(preset.name.length).toBeGreaterThan(0);
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
  });

  it("local stdio presets do not require auth tokens", () => {
    for (const id of ["postgres", "sqlite", "filesystem", "slack", "memory"]) {
      expect(findMcpPreset(id)!.requiresAuthToken).toBe(false);
    }
  });
});
