/**
 * Persistent MCP Session Store
 *
 * Replaces the in-memory Map with PostgreSQL-backed session storage.
 * Sessions survive server restarts and work with serverless deployments.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

interface SessionData {
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

