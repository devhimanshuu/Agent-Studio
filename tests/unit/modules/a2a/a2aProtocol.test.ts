import { describe, it, expect, vi, afterEach } from "vitest";
import { discoverA2AAgent, delegateA2ATask, sendA2AMessage } from "@/modules/a2a/client";
import { A2A_AGENT_PRESETS } from "@/modules/a2a/presets";

describe("Google Agent-to-Agent (A2A) Protocol", { timeout: 15000 }, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discovers built-in A2A preset agents instantly", async () => {
    const preset = A2A_AGENT_PRESETS[0];
    const manifest = await discoverA2AAgent(preset.name);

    expect(manifest.name).toBe(preset.name);
    expect(manifest.protocolVersion).toBe("1.0.0");
    expect(manifest.endpoints.tasks).toBeTruthy();
    expect(manifest.capabilities.length).toBeGreaterThan(0);
  });

  it("throws instead of fabricating a manifest when no agent is reachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    await expect(discoverA2AAgent("http://unreachable.invalid")).rejects.toThrow(/Could not discover/);
  });

  it("handles A2A task delegation and streaming tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ result: { output: "done" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

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

  it("surfaces the real failure instead of faking a successful delegation on network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    await expect(
      delegateA2ATask("http://localhost:3000/api/a2a/tasks", {
        capability: "autonomous_delegation",
        input: { prompt: "Test task execution" },
      })
    ).rejects.toThrow(/A2A task delegation .* failed/);
  });

  it("exchanges turn-based dialogue in multi-agent channels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ reply: "Acknowledged, proceeding with pgvector analysis." }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const response = await sendA2AMessage("http://localhost:3000/api/a2a/messages", {
      sender: "Specialist Proposer",
      role: "agent",
      turn: 1,
      content: "Proposing pgvector for unified transactional vector search.",
    });

    expect(response.reply).toBeTruthy();
    expect(typeof response.timestamp).toBe("number");
  });

  it("surfaces the real failure instead of returning a scripted reply on network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    await expect(
      sendA2AMessage("http://localhost:3000/api/a2a/messages", {
        sender: "Specialist Proposer",
        role: "agent",
        turn: 1,
        content: "Proposing pgvector for unified transactional vector search.",
      })
    ).rejects.toThrow(/A2A message .* failed/);
  });
});
