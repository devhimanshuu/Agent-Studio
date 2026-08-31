import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClerkClient } from "@clerk/nextjs/server";

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecretKey ? createClerkClient({ secretKey: clerkSecretKey }) : null;

/**
 * Ensures a User record exists in the database for the given Clerk userId.
 * Automatically gives every new/existing user ADMIN role, synchronizes their
 * Clerk email & name, and provisions an Enterprise organization where they are OWNER.
 */
export async function ensureUserExists(
  userId: string,
  client: Prisma.TransactionClient | PrismaClient = prisma
): Promise<void> {
  if (!userId) return;

  let email = `${userId}@agent-studio.internal`;
  let name: string | null = null;

  if (clerk) {
    try {
      const clerkUser = await clerk.users.getUser(userId);
      if (clerkUser) {
        const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress;
        if (primaryEmail) email = primaryEmail;
        const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
        if (fullName) name = fullName;
      }
    } catch {
      // Non-blocking in testing or offline environments
    }
  }

  // Every user who signs up or signs in is an ADMIN with full access
  await client.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      name,
      role: "ADMIN",
    },
    update: {
      role: "ADMIN",
      ...(email !== `${userId}@agent-studio.internal` && { email }),
      ...(name && { name }),
    },
  });

  // Ensure the user has an Enterprise Organization Workspace where they are OWNER
  try {
    const existingOrgMembership = await client.organizationMember.findFirst({
      where: { userId },
      include: { organization: true },
    });

    if (!existingOrgMembership) {
      const displayName = name || email.split("@")[0] || "My";
      const orgName = `${displayName}'s Workspace`;
      const cleanSlug = `org-${userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18)}`;

      await client.organization.create({
        data: {
          name: orgName,
          slug: cleanSlug,
          plan: "enterprise",
          billingEmail: email.includes("@") ? email : undefined,
          settings: {
            sso: true,
            auditExport: true,
            customRoles: true,
          },
          members: {
            create: {
              userId,
              role: "OWNER",
              permissions: [],
            },
          },
        },
      });
    }
  } catch {
    // Non-blocking if already exists or concurrent creation
  }
}
