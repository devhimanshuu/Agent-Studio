import { describe, it, expect, vi, afterEach } from "vitest";
import { A2AClientService } from "@/services/A2AClientService";
import { discoverA2AAgent, delegateA2ATask, sendA2AMessage } from "@/modules/a2a/client";

function makeSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: c })}\n\n`));
      }
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("A2AClientService & Google A2A Protocol", () => {
  const service = new A2AClientService();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists presets — only genuinely reachable agents this app itself serves", () => {
    // There is no external A2A registry this app has access to, so the preset
    // list intentionally contains only the local, self-hosted agent gateway —
    // not fabricated third-party agents pointing at domains that don't exist.
    const presets = service.listPresets();
    expect(presets.length).toBeGreaterThanOrEqual(1);
    const local = presets.find((p) => p.name === "local-studio-agent-gateway");
    expect(local).toBeDefined();
    expect(local?.protocolVersion).toBe("1.0.0");
    expect(local?.endpoints.tasks).toBe("/api/a2a/tasks");
  });

  it("discovers preset agent by identifier or url", async () => {
    const manifest = await service.discover("local-studio-agent-gateway");
    expect(manifest.name).toBe("local-studio-agent-gateway");
    expect(manifest.endpoints.tasks).toContain("tasks");
  });

  it("throws instead of fabricating a manifest for an unreachable custom endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    await expect(discoverA2AAgent("https://custom-agent.internal.net")).rejects.toThrow(/Could not discover/);
  });

  it("delegates task payload with streaming token callback support", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => makeSseResponse(["Hello ", "World"])));

    const receivedChunks: string[] = [];
    const response = await delegateA2ATask(
      "https://example-a2a-agent.test/tasks",
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

  it("surfaces a real delegation failure instead of a fabricated result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Internal Error", { status: 500 })));
    await expect(
      delegateA2ATask("https://example-a2a-agent.test/tasks", {
        capability: "deep_research",
        input: { topic: "test" },
      })
    ).rejects.toThrow(/A2A task delegation .* failed/);
  });

  it("sends cross-agent dialogue messages in multi-agent channels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ reply: "Architecture plan acknowledged and refined." }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const res = await sendA2AMessage("https://example-a2a-agent.test/messages", {
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
