import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { pgVectorStore } from "@/modules/rag";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/rag/documents/[id]
 * Fetch document detail with all chunks. Scoped to the authenticated user's own documents.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await props.params;
    const document = await pgVectorStore.getDocument(id, userId);

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to get document detail from pgvector");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get document" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rag/documents/[id]
 * Scoped to the authenticated user's own documents.
 */
export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await props.params;
    const deleted = await pgVectorStore.deleteDocument(id, userId);

    if (!deleted) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete document from pgvector");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete document" },
      { status: 500 }
    );
  }
}
