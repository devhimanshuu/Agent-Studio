import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { pgVectorStore } from "@/modules/rag";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/rag/documents
 * List stored documents, collections, and stats — scoped to the authenticated user.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const collection = url.searchParams.get("collection") || undefined;
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
 * Delete document and cascade chunks. Scoped to the authenticated user's own documents.
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
      return NextResponse.json({ error: "Query param 'id' is required" }, { status: 400 });
    }

    const deleted = await pgVectorStore.deleteDocument(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    logger.info({ documentId: id, userId }, "Document and its pgvector chunks deleted");
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete document from pgvector");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete document" },
      { status: 500 }
    );
  }
}
