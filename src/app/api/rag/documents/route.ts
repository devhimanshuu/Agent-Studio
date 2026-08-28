import { NextResponse } from "next/server";
import { pgVectorStore } from "@/modules/rag";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/rag/documents
 * List stored documents, collections, and stats.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const collection = url.searchParams.get("collection") || undefined;
    const userId = url.searchParams.get("userId") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const includeCollections = url.searchParams.get("includeCollections") === "true";

    const { documents, total } = await pgVectorStore.listDocuments({
      collection,
      userId,
      limit,
      offset,
    });

    const stats = await pgVectorStore.getStats(userId, collection);
    const collections = includeCollections ? await pgVectorStore.listCollections(userId) : undefined;

    return NextResponse.json({
      success: true,
      documents,
      total,
      stats,
      collections,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to list documents from pgvector");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list documents" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rag/documents?id=...
 * Delete document and cascade chunks.
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Query param 'id' is required" }, { status: 400 });
    }

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
