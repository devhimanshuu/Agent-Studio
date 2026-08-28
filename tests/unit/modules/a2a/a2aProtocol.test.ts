import { describe, it, expect, vi } from "vitest";
import { discoverA2AAgent, delegateA2ATask, sendA2AMessage } from "@/modules/a2a/client";
import { A2A_AGENT_PRESETS } from "@/modules/a2a/presets";

describe("Google Agent-to-Agent (A2A) Protocol", { timeout: 15000 }, () => {
  it("discovers built-in A2A preset agents instantly", async () => {
    const preset = A2A_AGENT_PRESETS[0];
    const manifest = await discoverA2AAgent(preset.name);

    expect(manifest.name).toBe(preset.name);
    expect(manifest.protocolVersion).toBe("1.0.0");
    expect(manifest.endpoints.tasks).toBeTruthy();
    expect(manifest.capabilities.length).toBeGreaterThan(0);
  });

  it("handles A2A task delegation and streaming tokens", async () => {
    const tokenChunks: string[] = [];
    const response = await delegateA2ATask(
      "http://localhost:3000/api/a2a/tasks",
      {
        capability: "autonomous_delegation",
        input: { prompt: "Test task execution" },
      },
      {
        onTokenChunk: (chunk) => {
          tokenChunks.push(chunk);
        },
      }
    );

    expect(response.status).toBe("completed");
    expect(response.taskId).toBeTruthy();
    expect(response.result).toBeDefined();
  });

  it("exchanges turn-based dialogue in multi-agent channels", async () => {
    const response = await sendA2AMessage("http://localhost:3000/api/a2a/messages", {
      sender: "Specialist Proposer",
      role: "agent",
      turn: 1,
      content: "Proposing pgvector for unified transactional vector search.",
    });

    expect(response.reply).toBeTruthy();
    expect(typeof response.timestamp).toBe("number");
  });
});
