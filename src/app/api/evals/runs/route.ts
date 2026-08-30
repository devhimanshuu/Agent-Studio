import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listEvalReports } from "@/modules/evals/evalRunner";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const runs = await listEvalReports(userId);
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
