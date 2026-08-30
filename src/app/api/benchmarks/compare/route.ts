import { NextRequest, NextResponse } from "next/server";
import { BUILT_IN_BENCHMARK_SUITES } from "@/modules/benchmarks/benchmarkEngine";
import { runModelComparison } from "@/modules/benchmarks/runner";

/**
 * POST /api/benchmarks/compare
 * Runs a benchmark suite against each requested model for real and returns a
 * genuinely measured comparison — replaces the old static GPT-4o/Claude/Gemini
 * baseline table, which never actually executed anything.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { suiteId, models } = body;

    if (!Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ success: false, error: "models array is required" }, { status: 400 });
    }

    const suite = BUILT_IN_BENCHMARK_SUITES.find((s) => s.id === suiteId) || BUILT_IN_BENCHMARK_SUITES[0];
    const data = await runModelComparison(suite, models);

    return NextResponse.json({ success: true, data, suiteId: suite.id, suiteName: suite.name });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Model comparison failed",
      },
      { status: 500 }
    );
  }
}
