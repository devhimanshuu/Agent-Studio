import { auth } from "@clerk/nextjs/server";
import { ExecutionRepository } from "@/repositories/ExecutionRepository";
import { executionEventBus, ExecutionEvent, GraphNodeStatus } from "@/modules/graph/eventBus";

/**
 * Server-Sent Events stream for live execution traces.
 *
 * On connect the route replays the persisted ExecutionStep rows (so a viewer
 * joining mid-run sees everything that happened before), then streams live
 * events from the in-process event bus. In multi-instance deployments the
 * replay covers the gap; the live tail is best-effort per instance.
 */

const executionRepo = new ExecutionRepository();

export const dynamic = "force-dynamic";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function encode(event: ExecutionEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  // Preview sessions stream through /api/canvas/preview/[id]/stream only —
  // never via the execution stream (defense in depth for tenant scoping).
  if (id.startsWith("preview-")) {
    return new Response("Execution not found", { status: 404 });
  }
  const execution = await executionRepo.findByIdForUser(id, userId);
  if (!execution) {
    return new Response("Execution not found", { status: 404 });
  }

  let cleanup: (() => void) | null = null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // Client disconnected — ignore.
        }
      };

      // 1. Replay persisted node steps as synthetic events so late viewers
      //    see the complete trace, not just the live tail.
      let seq = 0;
      for (const step of execution.steps ?? []) {
        seq += 1;
        const started: ExecutionEvent = {
          type: "node:start",
          executionId: id,
          seq,
          at: new Date(step.startedAt).getTime(),
          nodeId: step.nodeName,
          nodeLabel: (step.stateSnapshot?.label as string) ?? step.nodeName,
          nodeType: (step.stateSnapshot?.type as string) ?? "step",
        };
        send(encode(started));

        seq += 1;
        const completed: ExecutionEvent = {
          type: "node:end",
          executionId: id,
          seq,
          at: new Date(step.completedAt ?? step.startedAt).getTime(),
          nodeId: step.nodeName,
          status: mapStepStatus(step.status),
          detail: step.status === "SUCCESS" ? "replayed from persisted trace" : undefined,
          ...(typeof step.stateSnapshot?.durationMs === "number"
            ? { durationMs: step.stateSnapshot.durationMs as number }
            : {}),
        };
        send(encode(completed));
      }

      // Terminal executions are fully replayed — close cleanly.
      const terminal = ["COMPLETED", "FAILED", "CANCELLED", "STEP_LIMIT_EXCEEDED"];
      if (terminal.includes(execution.status)) {
        send(`event: execution:status\ndata: ${JSON.stringify({ type: "execution:status", executionId: id, seq: ++seq, at: Date.now(), status: execution.status })}\n\n`);
        controller.close();
        return;
      }

      // 2. Live events from the in-process bus.
      const unsubscribe = executionEventBus.subscribe(id, (event) => {
        send(encode(event));
      });

      // 3. Heartbeat comment every 15s keeps proxies from closing the idle stream.
      const heartbeat = setInterval(() => {
        send(`: ping\n\n`);
      }, 15_000);

      // 4. Cleanup on client disconnect.
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
    },
    cancel() {
      // Client aborted the connection — release the bus subscription.
      cleanup?.();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

function mapStepStatus(status: string): GraphNodeStatus {
  switch (status) {
    case "SUCCESS":
      return "SUCCESS";
    case "FAILED":
      return "FAILED";
    case "AWAITING_APPROVAL":
      return "AWAITING_APPROVAL";
    case "SKIPPED":
      return "SKIPPED";
    default:
      return "RUNNING";
  }
}
