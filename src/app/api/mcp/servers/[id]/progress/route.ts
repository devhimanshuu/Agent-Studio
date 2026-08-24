import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";


const { mcpService } = apiServices();

/**
 * GET /api/mcp/servers/:id/progress
 * SSE endpoint that streams MCP progress notifications in real-time.
 * Used by the UI to display live progress bars during tool/resource/prompt calls.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = () => {};
      const safeUnsubscribe = () => {
        closed = true;
        try { unsubscribe?.(); } catch { /* noop */ }
        unsubscribe = null;
      };

      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", serverId: id, timestamp: Date.now() })}\n\n`)
      );

      // Subscribe to progress events from the MCP connection.
      // Async: the service verifies OWNERSHIP before attaching the listener —
      // a non-owner (or unconnected server) resolves to a no-op subscription.
      void mcpService.onProgress(id, userId, (event) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream may be closed by the client
          safeUnsubscribe();
        }
      }).then((unsub) => {
        if (closed) { try { unsub(); } catch { /* noop */ } return; }
        unsubscribe = unsub;
      });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return; }
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", timestamp: Date.now() })}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
          safeUnsubscribe();
        }
      }, 30_000);

      // Clean up when client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        safeUnsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
