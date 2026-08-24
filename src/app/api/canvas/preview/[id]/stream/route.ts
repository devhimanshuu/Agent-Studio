import { auth } from "@clerk/nextjs/server";
import { executionEventBus, ExecutionEvent } from "@/modules/graph/eventBus";
import { GraphInterpreter } from "@/modules/graph/graphInterpreter";
import { previewStore } from "@/modules/graph/previewStore";
import { createToolRegistry } from "@/modules/tools";
import { PermissionChecker } from "@/modules/execution/tool-registry/permissionChecker";
import { getLLMProvider } from "@/providers/llm";
import { AgentGraphDefinition } from "@/types/graph";
import { logger } from "@/lib/logger";
import { apiServices } from "@/lib/api/services";

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

const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED", "STEP_LIMIT_EXCEEDED", "PAUSED_FOR_APPROVAL"];

/**
 * Ghost-mode preview stream. The first subscriber starts the dry-run so no
 * events are lost; terminal status closes the stream. Preview sessions are
 * scoped to the owning user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const session = previewStore.get(id);
  if (!session || session.userId !== userId) {
    return new Response("Preview not found", { status: 404 });
  }

  let cleanup: (() => void) | null = null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // Client disconnected.
        }
      };

      const unsubscribe = executionEventBus.subscribe(id, (event) => {
        send(encode(event));
        if (event.type === "execution:status" && TERMINAL.includes(event.status)) {
          cleanup?.();
        }
      });

      const heartbeat = setInterval(() => {
        send(`: ping\n\n`);
      }, 15_000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      // Kick off the dry-run once — on the first subscriber.
      if (!session.started) {
        session.started = true;
        void runPreview(id, session.userId, session.skillVersionId, session.graph, session.inputData)
          .catch((error) => {
            logger.error({ previewId: id, err: error }, "Ghost preview failed");
            const statusEvent: ExecutionEvent = {
              type: "execution:status",
              executionId: id,
              seq: Date.now(),
              at: Date.now(),
              status: "FAILED",
            };
            send(encode(statusEvent));
            cleanup?.();
          })
          .finally(() => {
            previewStore.delete(id);
          });
      }
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

/** Run the graph interpreter in dry-run mode against the preview session. */
async function runPreview(
  previewId: string,
  userId: string,
  skillVersionId: string,
  graph: AgentGraphDefinition,
  inputData: Record<string, unknown>
): Promise<void> {
  const { skillRepo, mcpService, openApiService, executionRepo, approvalRepo, logRepo } = apiServices();

  const version = await skillRepo.findVersionById(skillVersionId);
  if (!version) throw new Error("Skill version not found");
  const skill = await skillRepo.findByIdForUser(version.skillId, userId);
  if (!skill) throw new Error("Skill not found");

  // Ghost previews run on an ISOLATED registry (never the shared execution
  // registries) so a preview can never mutate live tool state mid-run.
  const toolRegistry = createToolRegistry();

  await Promise.all([
    mcpService.registerUserMcpTools(userId, toolRegistry).catch((err) => {
      logger.warn({ userId, err }, "Failed to sync MCP tools for preview");
    }),
    openApiService.syncRegistryTools(userId, toolRegistry).catch((err) => {
      logger.warn({ userId, err }, "Failed to sync OpenAPI tools for preview");
    }),
  ]);

  const interpreter = new GraphInterpreter({
    llm: getLLMProvider(),
    toolRegistry,
    permissionChecker: new PermissionChecker(),
    executionRepo,
    approvalRepo,
    logRepo,
  });

  await interpreter.run({
    executionId: previewId,
    skill,
    version,
    graph,
    userInput: inputData,
    dryRun: true,
  });
}
