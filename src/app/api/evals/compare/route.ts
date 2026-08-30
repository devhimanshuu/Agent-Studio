import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getEvalReportById, compareEvaluationRuns } from "@/modules/evals/evalRunner";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    const runA = await getEvalReportById(runAId, userId);
    const runB = await getEvalReportById(runBId, userId);

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
