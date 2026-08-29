import { NextRequest, NextResponse } from "next/server";
import { getEvalReportById, compareEvaluationRuns } from "@/modules/evals/evalRunner";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runAId = searchParams.get("runA");
    const runBId = searchParams.get("runB");

    if (!runAId || !runBId) {
      return NextResponse.json(
        { success: false, error: "Both 'runA' and 'runB' query parameters are required for comparison." },
        { status: 400 }
      );
    }

    const runA = getEvalReportById(runAId);
    const runB = getEvalReportById(runBId);

    if (!runA || !runB) {
      return NextResponse.json(
        { success: false, error: "One or both evaluation runs could not be found." },
        { status: 404 }
      );
    }

    const comparison = compareEvaluationRuns(runA, runB);
    return NextResponse.json({ success: true, data: comparison });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to compare evaluation runs" },
      { status: 500 }
    );
  }
}
