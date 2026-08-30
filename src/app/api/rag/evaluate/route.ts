import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { evaluateRAGTriad } from "@/modules/rag/evaluation";

export const dynamic = "force-dynamic";

/**
 * POST /api/rag/evaluate
 * Evaluates the RAG Triad for a query, context chunks, and answer using an LLM judge.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { query, contextChunks = [], generatedAnswer } = body;

    if (!query || !generatedAnswer) {
      return NextResponse.json(
        { error: "Fields 'query' and 'generatedAnswer' are required" },
        { status: 400 }
      );
    }

    const evaluation = await evaluateRAGTriad({
      query,
      contextChunks,
      generatedAnswer,
    });

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to evaluate RAG Triad" },
      { status: 500 }
    );
  }
}
