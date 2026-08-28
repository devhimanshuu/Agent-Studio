import { NextResponse } from "next/server";
import { pgVectorStore } from "@/modules/rag";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/rag/documents/[id]
 * Fetch document detail with all chunks.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const document = await pgVectorStore.getDocument(id);

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
 */
export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const deleted = await pgVectorStore.deleteDocument(id);

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
