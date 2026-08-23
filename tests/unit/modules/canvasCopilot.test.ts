import { describe, it, expect } from "vitest";

function extractGraphJson(raw: string): unknown {
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  } else {
    const jsonStart = jsonStr.indexOf("{");
    const jsonEnd = jsonStr.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1).trim();
    }
  }
  return JSON.parse(jsonStr);
}

describe("Canvas Copilot JSON Extraction", () => {
  it("extracts clean JSON from pure JSON output", () => {
    const raw = `{"version": 1, "nodes": [], "edges": []}`;
    const parsed = extractGraphJson(raw);
    expect(parsed).toEqual({ version: 1, nodes: [], edges: [] });
  });

  it("extracts JSON from standard markdown code fence", () => {
    const raw = "```json\n{\n  \"version\": 1,\n  \"nodes\": [],\n  \"edges\": []\n}\n```";
    const parsed = extractGraphJson(raw);
    expect(parsed).toEqual({ version: 1, nodes: [], edges: [] });
  });

  it("extracts JSON when preceded by conversational greeting and preamble", () => {
    const raw = "Here is the multi-agent graph architecture you requested:\n\n```json\n{\n  \"version\": 1,\n  \"nodes\": [{\"id\": \"start\", \"type\": \"start\"}],\n  \"edges\": []\n}\n```\nHope this helps!";
    const parsed = extractGraphJson(raw);
    expect(parsed).toEqual({
      version: 1,
      nodes: [{ id: "start", type: "start" }],
      edges: [],
    });
  });

  it("extracts JSON with text preamble without markdown code fence", () => {
    const raw = "Sure! Here is the JSON: {\"version\": 1, \"nodes\": [], \"edges\": []} Let me know if you need changes.";
    const parsed = extractGraphJson(raw);
    expect(parsed).toEqual({ version: 1, nodes: [], edges: [] });
  });
});
