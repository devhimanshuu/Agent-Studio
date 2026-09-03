import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLLMProvider } from "@/providers/llm";
import { A2AMessageSchema } from "@/validators/a2aSchema";
import { rateLimit } from "@/lib/api/rateLimit";
import { logger } from "@/lib/logger";
import {
  appendTurn,
  getOrCreateSession,
  getSession,
  SessionOwnershipError,
  type DebateTurn,
} from "@/modules/a2a/debateStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/a2a/messages — multi-agent channel / debate dialogue endpoint.
 *
 * Auth: requires a Clerk session. Unauthenticated callers receive 401; the
 * public MCP bearer-token escape hatch does NOT extend here because every
 * call costs LLM tokens.
 *
 * State: callers may include `sessionId` (and `topic` on the first message)
 * to bind messages into a long-running debate. The full transcript is fed
 * back into the LLM so each turn is context-aware instead of a generic reply.
 *
 * Rate-limit: 30 calls / minute / user (in-process sliding window) to keep a
 * single user from burning tokens on an unbounded loop.
 *
 * Scoping: when a `sessionId` is provided, the caller MUST own the session
 * (the userId who first created it). Cross-user access is rejected with 403.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required", code: "UNAUTHENTICATED" },
      { status: 401, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const limited = rateLimit(`a2a:messages:${userId}`);
  if (limited) {
    return limited;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  // sessionId + topic ride on the A2AMessage.metadata envelope so the
  // existing wire shape stays backwards-compatible with prior test fixtures.
  const metadata =
    body && typeof body === "object" && "metadata" in body
      ? ((body as { metadata?: Record<string, unknown> }).metadata ?? {})
      : {};

  const parsed = A2AMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid A2A message payload",
        code: "VALIDATION_ERROR",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const message = parsed.data;
  const sessionId =
    typeof metadata.sessionId === "string" && metadata.sessionId.length > 0
      ? metadata.sessionId
      : null;
  const topic =
    typeof metadata.topic === "string" && metadata.topic.length > 0
      ? metadata.topic
      : undefined;

  if (sessionId && sessionId.length > 128) {
    return NextResponse.json(
      { success: false, error: "sessionId too long (max 128 chars)", code: "BAD_REQUEST" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  let sessionOwner: string | null = null;
  if (sessionId) {
    try {
      getOrCreateSession(sessionId, userId, topic);
    } catch (err) {
      if (err instanceof SessionOwnershipError) {
        return NextResponse.json(
          {
            success: false,
            error: "Session belongs to a different user",
            code: "FORBIDDEN",
          },
          { status: 403, headers: { "Access-Control-Allow-Origin": "*" } },
        );
      }
      throw err;
    }
    const existing = getSession(sessionId);
    sessionOwner = existing?.ownerUserId ?? null;
  }

  const incomingTurn: DebateTurn = {
    sender: message.sender,
    role: message.role,
    content: message.content,
    turn: message.turn ?? 0,
    at: Date.now(),
  };
  if (sessionId) appendTurn(sessionId, incomingTurn);

  try {
    const llm = getLLMProvider();

    const transcript =
      sessionId
        ? getSession(sessionId)?.turns ?? []
        : [];

    const systemLines = [
      "You are an autonomous participant in an A2A multi-agent conversation.",
      `Your caller is ${message.sender} (role: ${message.role}).`,
    ];
    if (sessionOwner) {
      systemLines.push(
        "This debate has live state — refer to the transcript below and advance the collective position; do not restart the conversation from scratch.",
      );
    }
    systemLines.push("Reply concisely and constructively. Stay strictly on the stated topic.");

    const messages = [
      { role: "system" as const, content: systemLines.join(" ") },
      ...(transcript.length > 0
        ? [
            {
              role: "system" as const,
              content:
                "CONVERSATION TRANSCRIPT (most recent last):\n" +
                transcript
                  .map(
                    (t) =>
                      `[turn ${t.turn}] ${t.sender} (${t.role}): ${t.content}`,
                  )
                  .join("\n"),
            },
          ]
        : []),
      { role: "user" as const, content: message.content },
    ];

    const completion = await llm.complete(messages);

    const replyTurn: DebateTurn = {
      sender: "Agent-Studio-Node",
      role: "agent",
      content: completion.content,
      turn: (message.turn ?? 0) + 1,
      at: Date.now(),
    };
    if (sessionId) appendTurn(sessionId, replyTurn);

    return NextResponse.json(
      {
        success: true,
        reply: completion.content,
        sender: "Agent-Studio-Node",
        turn: replyTurn.turn,
        timestamp: replyTurn.at,
        sessionId,
      },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  } catch (error) {
    logger.error({ err: error, userId, sessionId }, "A2A message handling failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "A2A message failed",
        timestamp: Date.now(),
      },
      {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    );
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}