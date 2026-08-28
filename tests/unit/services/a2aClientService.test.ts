import { describe, it, expect, vi } from "vitest";
import { A2AClientService } from "@/services/A2AClientService";
import { discoverA2AAgent, delegateA2ATask, sendA2AMessage } from "@/modules/a2a/client";

describe("A2AClientService & Google A2A Protocol", () => {
  const service = new A2AClientService();

  it("lists curated A2A agent presets", () => {
    const presets = service.listPresets();
    expect(presets.length).toBeGreaterThanOrEqual(3);
    const gemini = presets.find((p) => p.name === "google-gemini-researcher");
    expect(gemini).toBeDefined();
    expect(gemini?.protocolVersion).toBe("1.0.0");
    expect(gemini?.capabilities.some((c) => c.id === "deep_research")).toBe(true);
  });

  it("discovers preset agent by identifier or url", async () => {
    const manifest = await service.discover("google-gemini-researcher");
    expect(manifest.name).toBe("google-gemini-researcher");
    expect(manifest.endpoints.tasks).toContain("tasks");
  });

  it("creates dynamic synthetic manifest for custom/offline endpoints without failing", async () => {
    const manifest = await discoverA2AAgent("https://custom-agent.internal.net");
    expect(manifest.protocolVersion).toBe("1.0.0");
    expect(manifest.endpoints.tasks).toContain("https://custom-agent.internal.net/tasks");
  });

  it("delegates task payload with streaming token callback support", async () => {
    const receivedChunks: string[] = [];
    const response = await delegateA2ATask(
      "https://a2a.agents.google.dev/v1/gemini-researcher/tasks",
      {
        capability: "deep_research",
        input: { topic: "Agent-to-Agent standard protocols" },
      },
      {
        onTokenChunk: (chunk) => receivedChunks.push(chunk),
      }
    );

    expect(response.status).toBe("completed");
    expect(response.taskId).toBeDefined();
    expect(response.result).toBeDefined();
    expect(receivedChunks.length).toBeGreaterThan(0);
  });

  it("sends cross-agent dialogue messages in multi-agent channels", async () => {
    const res = await sendA2AMessage("https://a2a.agents.google.dev/messages", {
      sender: "Specialist Proposer",
      role: "agent",
      content: "Proposed architecture plan for multi-agent delegation.",
      turn: 1,
    });

    expect(res.reply).toBeDefined();
    expect(typeof res.reply).toBe("string");
    expect(res.timestamp).toBeGreaterThan(0);
  });
});
