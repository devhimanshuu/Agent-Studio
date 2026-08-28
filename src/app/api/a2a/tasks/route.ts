import { NextResponse } from "next/server";
import { A2ATaskRequest, A2ATaskResponse } from "@/types/a2a";
import { getLLMProvider } from "@/providers/llm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const streamMode = url.searchParams.get("stream") === "true";
  const started = Date.now();

  try {
    const body = (await request.json()) as A2ATaskRequest;
    const taskId = body.taskId || `a2a_in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const capability = body.capability || "visual_graph_orchestration";
    const inputPayload = body.input || {};

    logger.info({ taskId, capability }, "Received inbound A2A task delegation");

    const promptText =
      typeof inputPayload.prompt === "string"
        ? inputPayload.prompt
        : JSON.stringify(inputPayload, null, 2);

    const llm = getLLMProvider();

    if (streamMode) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            const streamIterable = await llm.stream([
              {
                role: "system",
                content:
                  "You are the Agent Studio A2A Autonomous Orchestrator responding to an inbound task delegation under the Google A2A Protocol. Provide a structured, high-quality response.",
              },
              { role: "user", content: `TASK INPUT:\n${promptText}` },
            ]);

            for await (const chunk of streamIterable) {
              if (chunk.content) {
                const sseData = JSON.stringify({ chunk: chunk.content, taskId });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              }
            }
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (err) {
            const errStr = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
            controller.enqueue(encoder.encode(`data: ${errStr}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Standard synchronous completion
    const completion = await llm.complete([
      {
        role: "system",
        content:
          "You are the Agent Studio A2A Autonomous Orchestrator. Process this delegated task cleanly and return a structured synthesis.",
      },
      { role: "user", content: `TASK INPUT:\n${promptText}` },
    ]);

    const response: A2ATaskResponse = {
      taskId,
      status: "completed",
      result: {
        output: completion.content,
        executedBy: "Agent-Studio-A2A-Runtime",
        capability,
      },
      durationMs: Date.now() - started,
      tokensUsed: completion.usage?.outputTokens,
    };

    return NextResponse.json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to process inbound A2A task");
    return NextResponse.json(
      {
        taskId: "error",
        status: "failed",
        error: error instanceof Error ? error.message : "Internal A2A Task Error",
        durationMs: Date.now() - started,
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-A2A-API-Key",
    },
  });
}
