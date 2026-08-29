import { NextResponse } from "next/server";
import { listEvalReports } from "@/modules/evals/evalRunner";

export async function GET() {
  try {
    const runs = listEvalReports();
    return NextResponse.json({
      success: true,
      data: runs,
      totalCount: runs.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to list evaluation runs" },
      { status: 500 }
    );
  }
}
