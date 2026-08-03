import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Ensures a User record exists in the database for the given Clerk userId.
 * Idempotently upserts the record to satisfy foreign key constraints on
 * tables referencing `users.id` (Skill, Execution, ApprovalRequest, AuditLog).
 */
export async function ensureUserExists(
  userId: string,
  client: Prisma.TransactionClient | PrismaClient = prisma
): Promise<void> {
  if (!userId) return;
  await client.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: `${userId}@agent-studio.internal`,
    },
    update: {},
  });
}
