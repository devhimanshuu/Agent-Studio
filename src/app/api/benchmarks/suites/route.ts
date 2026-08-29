import { NextResponse } from "next/server";
import { BUILT_IN_BENCHMARK_SUITES, BASELINE_MODEL_COMPARISONS } from "@/modules/benchmarks/benchmarkEngine";

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: {
        suites: BUILT_IN_BENCHMARK_SUITES,
        baselineModels: BASELINE_MODEL_COMPARISONS,
        totalSuites: BUILT_IN_BENCHMARK_SUITES.length,
        totalTestCases: BUILT_IN_BENCHMARK_SUITES.reduce((acc, s) => acc + s.testCases.length, 0),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load benchmark suites",
      },
      { status: 500 }
    );
  }
}
