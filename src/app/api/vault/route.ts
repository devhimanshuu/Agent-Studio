import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { VaultService, VaultEntryInput, VaultCategory } from "@/services/VaultService";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const vaultService = new VaultService();

/**
 * GET /api/vault — List all vault entries (values masked)
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("q");

    const entries = search
      ? await vaultService.search(userId, search)
      : await vaultService.list(userId);

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
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as VaultEntryInput & { category?: string };

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

    const entry = await vaultService.create(userId, {
      name: body.name,
      category: (body.category as VaultCategory) || "API_KEY",
      key: body.key,
      value: body.value,
      description: body.description,
      tags: body.tags,
    });

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

    const entry = await vaultService.update(userId, body.id, {
      name: body.name,
      category: body.category as VaultCategory | undefined,
      key: body.key,
      value: body.value,
      description: body.description,
      tags: body.tags,
    });

    return NextResponse.json({ success: true, data: entry });
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

    await vaultService.delete(userId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete vault entry");
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
