import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { projectVectorsTo2D } from "@/modules/rag/clusterVisualizer";
import { generateEmbedding } from "@/modules/rag/embeddingService";

export const dynamic = "force-dynamic";

/**
 * GET /api/rag/cluster?collection=...&query=...
 * Computes 2D PCA projection for stored document embeddings.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const collection = url.searchParams.get("collection") || undefined;
    const query = url.searchParams.get("query") || undefined;

    const whereClause: Record<string, unknown> = {};
    if (collection) whereClause.collection = collection;

    let chunks: Array<{
      id: string;
      documentId: string;
      content: string;
      tokenCount: number | null;
      embedding: number[];
      metadata: unknown;
      document: {
        title: string;
        collection: string;
      };
    }> = [];

    try {
      chunks = await prisma.documentChunk.findMany({
        where: {
          document: whereClause,
        },
        select: {
          id: true,
          documentId: true,
          content: true,
          tokenCount: true,
          embedding: true,
          metadata: true,
          document: {
            select: {
              title: true,
              collection: true,
            },
          },
        },
        take: 300,
      });
    } catch {
      chunks = [];
    }

    let queryVector: { vector: number[]; text: string } | undefined;
    if (query && query.trim()) {
      try {
        const emb = await generateEmbedding({ text: query.trim() });
        queryVector = { vector: emb.vector, text: query.trim() };
      } catch {
        // Continue
      }
    }

    const items = chunks.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      title: c.document.title,
      collection: c.document.collection,
      content: c.content,
      embedding: c.embedding || [],
      tokenCount: c.tokenCount || undefined,
      section: (c.metadata as Record<string, unknown>)?.section as string | undefined,
    }));

    const clusterData = projectVectorsTo2D(items, queryVector);

    return NextResponse.json({
      success: true,
      ...clusterData,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute vector clusters" },
      { status: 500 }
    );
  }
}
