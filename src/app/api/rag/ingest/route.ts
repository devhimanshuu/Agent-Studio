import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { defaultRAGPipeline } from "@/modules/rag";
import { ensureUserExists } from "@/lib/user";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/rag/ingest
 * Ingests a document: performs chunking, vector embedding, and pgvector storage.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      content,
      title,
      collection = "default",
      source,
      mimeType = "text/plain",
      chunking = {},
      metadata = {},
      tags = [],
      embeddingModel,
      useParentChunking = false,
    } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Field 'content' is required and must be non-empty text" },
        { status: 400 }
      );
    }

    const docTitle = title && typeof title === "string" ? title.trim() : "Untitled Document";

    logger.info({ title: docTitle, collection, length: content.length }, "Ingesting document into pgvector");

    await ensureUserExists(userId);

    const result = await defaultRAGPipeline.ingest({
      content,
      title: docTitle,
      collection,
      source,
      mimeType,
      chunking,
      metadata: {
        ...metadata,
        tags: Array.isArray(tags) ? tags : [],
        embeddingModel: embeddingModel || undefined,
      },
      userId,
      useParentChunking,
    });

    if (!result || result.chunkCount === 0) {
      logger.warn(
        { title: docTitle, contentLength: content.length, strategy: chunking.strategy },
        "Ingestion produced zero chunks — chunking strategy may not match content shape",
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Document was ingested but produced no usable chunks. Try a different chunking strategy or increase the maxChunkSize.",
          code: "NO_CHUNKS_PRODUCED",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      document: result,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to ingest document into pgvector");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to ingest document",
      },
      { status: 500 }
    );
  }
}
