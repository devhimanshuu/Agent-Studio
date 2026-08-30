/**
 * Persistent MCP Session Store
 *
 * Replaces the in-memory Map with PostgreSQL-backed session storage.
 * Sessions survive server restarts and work with serverless deployments.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

export interface SessionData {
  /** Session ID */
  sessionId: string;
  /** Server ID this session is connected to */
  serverId?: string;
  /** User ID who created this session */
  userId?: string;
  /** Transport type */
  transport: string;
  /** Session status */
  status: "ACTIVE" | "EXPIRED" | "CLOSED";
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** When the session expires */
  expiresAt?: Date;
}

/**
 * Store a new MCP session in the database.
 */
export async function createSession(data: SessionData): Promise<void> {
  try {
    await prisma.mcpSession.create({
      data: {
        sessionId: data.sessionId,
        serverId: data.serverId,
        userId: data.userId,
        transport: data.transport,
        status: data.status,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
        expiresAt: data.expiresAt,
        lastActiveAt: new Date(),
      },
    });
    logger.info({ sessionId: data.sessionId }, "MCP session created");
  } catch (error) {
    logger.error({ error, sessionId: data.sessionId }, "Failed to create MCP session");
    throw error;
  }
}

/**
 * Get a session by ID.
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  try {
    const session = await prisma.mcpSession.findUnique({
      where: { sessionId },
    });

    if (!session) return null;

    // Check if session is expired
    if (session.expiresAt && session.expiresAt < new Date()) {
      await updateSessionStatus(sessionId, "EXPIRED");
      return null;
    }

    // Update last active timestamp
    await prisma.mcpSession.update({
      where: { sessionId },
      data: { lastActiveAt: new Date() },
    });

    return {
      sessionId: session.sessionId,
      serverId: session.serverId ?? undefined,
      userId: session.userId ?? undefined,
      transport: session.transport,
      status: session.status as "ACTIVE" | "EXPIRED" | "CLOSED",
      metadata: session.metadata as Record<string, unknown> ?? undefined,
      expiresAt: session.expiresAt ?? undefined,
    };
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to get MCP session");
    return null;
  }
}

/**
 * Update session status.
 */
export async function updateSessionStatus(
  sessionId: string,
  status: "ACTIVE" | "EXPIRED" | "CLOSED"
): Promise<void> {
  try {
    await prisma.mcpSession.update({
      where: { sessionId },
      data: { status, lastActiveAt: new Date() },
    });
    logger.info({ sessionId, status }, "MCP session status updated");
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to update MCP session status");
  }
}

/**
 * Delete a session.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await prisma.mcpSession.delete({
      where: { sessionId },
    });
    logger.info({ sessionId }, "MCP session deleted");
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to delete MCP session");
  }
}

