import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { VaultService, VaultEntryInput, VaultCategory } from "@/services/VaultService";
import { logger } from "@/lib/logger";
import { RBACService } from "@/services/RBACService";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const vaultService = new VaultService();
const rbacService = new RBACService();

/**
 * GET /api/vault — List all vault entries (values masked)
 * Supports optional organization context via X-Organization-Id header
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("q");
    const organizationId = request.headers.get("X-Organization-Id") || url.searchParams.get("organizationId") || undefined;

    let entries;
    if (organizationId) {
      // Verify membership
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // List vault entries for organization
      entries = await prisma.vaultEntry.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
      });
    } else {
      entries = search
        ? await vaultService.search(userId, search)
        : await vaultService.list(userId);
    }

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    logger.error({ error }, "Failed to list vault entries");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault — Create a new vault entry
 * Requires create permission in organization context
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as VaultEntryInput & { category?: string; organizationId?: string };

    if (!body.name || !body.key || !body.value) {
      return NextResponse.json(
        { error: "name, key, and value are required" },
        { status: 400 }
      );
    }

    // Validate key format (environment variable style)
    if (!/^[A-Z_][A-Z0-9_]*$/.test(body.key)) {
      return NextResponse.json(
        { error: "Key must be an uppercase environment variable name (e.g. GITHUB_TOKEN)" },
        { status: 400 }
      );
    }

    // Get organization context
    const organizationId = request.headers.get("X-Organization-Id") || body.organizationId || undefined;

    // Check permission if organization context
    if (organizationId) {
      const membership = await rbacService.getOrgMembership(userId, organizationId);
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const permissions = await rbacService.getUserOrgPermissions(userId, organizationId);
      if (!permissions.canCreateSkill) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const entry = await vaultService.create(userId, {
      name: body.name,
      category: (body.category as VaultCategory) || "API_KEY",
      key: body.key,
      value: body.value,
      description: body.description,
      tags: body.tags,
    });

    // Link to organization if provided
    if (organizationId) {
      await prisma.vaultEntry.update({
        where: { id: entry.id },
        data: { organizationId },
      });
    }

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Failed to create vault entry");
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PUT /api/vault — Update an existing vault entry
 */
export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id: string } & Partial<VaultEntryInput>;

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Check ownership or admin permission
    const entry = await prisma.vaultEntry.findUnique({
      where: { id: body.id },
      select: { userId: true, organizationId: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Vault entry not found" }, { status: 404 });
    }

    if (entry.userId !== userId) {
      // Check organization admin permission
      if (entry.organizationId) {
        const membership = await rbacService.getOrgMembership(userId, entry.organizationId);
        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updated = await vaultService.update(userId, body.id, {
      name: body.name,
      category: body.category as VaultCategory | undefined,
      key: body.key,
      value: body.value,
      description: body.description,
      tags: body.tags,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error({ error }, "Failed to update vault entry");
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("not found") ? 404 : message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/vault?id=xxx — Delete a vault entry
 */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Check ownership or admin permission
    const entry = await prisma.vaultEntry.findUnique({
      where: { id },
      select: { userId: true, organizationId: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Vault entry not found" }, { status: 404 });
    }

    if (entry.userId !== userId) {
      // Check organization admin permission
      if (entry.organizationId) {
        const membership = await rbacService.getOrgMembership(userId, entry.organizationId);
        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await vaultService.delete(userId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete vault entry");
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
