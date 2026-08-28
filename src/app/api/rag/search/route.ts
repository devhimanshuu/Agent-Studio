import { NextResponse } from "next/server";
import { defaultRAGPipeline } from "@/modules/rag";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/rag/search
 * Semantic retrieval over pgvector embeddings with prompt augmentation and QA.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      query,
      collection,
      userId,
      limit = 5,
      minScore = 0.2,
      metadataFilter,
      generateAnswer = false,
      augmentPrompt = false,
      basePrompt = "You are an intelligent assistant. Answer the user query using the provided context.",
      systemPrompt,
    } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Field 'query' is required and must be non-empty text" },
        { status: 400 }
      );
    }

    const cleanQuery = query.trim();

    // 1. End-to-end Grounded QA
    if (generateAnswer) {
      const qaResult = await defaultRAGPipeline.generateAnswer(cleanQuery, {
        collection,
        userId,
        limit,
        minScore,
        metadataFilter,
        systemPrompt,
      });

      return NextResponse.json({
        success: true,
        mode: "qa",
        result: qaResult,
      });
    }

    // 2. Prompt Augmentation
    if (augmentPrompt) {
      const promptResult = await defaultRAGPipeline.augmentPrompt(cleanQuery, basePrompt, {
        collection,
        userId,
        limit,
        minScore,
        metadataFilter,
      });

      return NextResponse.json({
        success: true,
        mode: "augmented_prompt",
        ...promptResult,
      });
    }

    // 3. Raw Semantic Vector Search
    const searchResult = await defaultRAGPipeline.retrieve({
      query: cleanQuery,
      collection,
      userId,
      limit,
      minScore,
      metadataFilter,
    });

    return NextResponse.json({
      success: true,
      mode: "search",
      ...searchResult,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to perform semantic search in pgvector");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to perform semantic search",
      },
      { status: 500 }
    );
  }
}
