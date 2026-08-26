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

/**
 * Get all active sessions for a server.
 */
export async function getSessionsByServer(serverId: string): Promise<SessionData[]> {
  try {
    const sessions = await prisma.mcpSession.findMany({
      where: {
        serverId,
        status: "ACTIVE",
      },
      orderBy: { lastActiveAt: "desc" },
    });

    return sessions.map(s => ({
      sessionId: s.sessionId,
      serverId: s.serverId ?? undefined,
      userId: s.userId ?? undefined,
      transport: s.transport,
      status: s.status as "ACTIVE" | "EXPIRED" | "CLOSED",
      metadata: s.metadata as Record<string, unknown> ?? undefined,
      expiresAt: s.expiresAt ?? undefined,
    }));
  } catch (error) {
    logger.error({ error, serverId }, "Failed to get sessions by server");
    return [];
  }
}

/**
 * Get all active sessions for a user.
 */
export async function getSessionsByUser(userId: string): Promise<SessionData[]> {
  try {
    const sessions = await prisma.mcpSession.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      orderBy: { lastActiveAt: "desc" },
    });

    return sessions.map(s => ({
      sessionId: s.sessionId,
      serverId: s.serverId ?? undefined,
      userId: s.userId ?? undefined,
      transport: s.transport,
      status: s.status as "ACTIVE" | "EXPIRED" | "CLOSED",
      metadata: s.metadata as Record<string, unknown> ?? undefined,
      expiresAt: s.expiresAt ?? undefined,
    }));
  } catch (error) {
    logger.error({ error, userId }, "Failed to get sessions by user");
    return [];
  }
}

/**
 * Clean up expired sessions.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.mcpSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, "Cleaned up expired MCP sessions");
    }

    return result.count;
  } catch (error) {
    logger.error({ error }, "Failed to cleanup expired sessions");
    return 0;
  }
}

/**
 * Get session statistics.
 */
export async function getSessionStats(): Promise<{
  total: number;
  active: number;
  expired: number;
  closed: number;
}> {
  try {
    const [total, active, expired, closed] = await Promise.all([
      prisma.mcpSession.count(),
      prisma.mcpSession.count({ where: { status: "ACTIVE" } }),
      prisma.mcpSession.count({ where: { status: "EXPIRED" } }),
      prisma.mcpSession.count({ where: { status: "CLOSED" } }),
    ]);

    return { total, active, expired, closed };
  } catch (error) {
    logger.error({ error }, "Failed to get session stats");
    return { total: 0, active: 0, expired: 0, closed: 0 };
  }
}
