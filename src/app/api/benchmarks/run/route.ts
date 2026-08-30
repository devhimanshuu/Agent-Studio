import { NextRequest, NextResponse } from "next/server";
import { BUILT_IN_BENCHMARK_SUITES } from "@/modules/benchmarks/benchmarkEngine";
import { runSuiteForModel } from "@/modules/benchmarks/runner";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { suiteId, model, skillName = "Active Agent Architecture" } = body;

    const suite = BUILT_IN_BENCHMARK_SUITES.find((s) => s.id === suiteId) || BUILT_IN_BENCHMARK_SUITES[0];
    const targetModel = model || suite.recommendedModel || "meta-llama/llama-3.3-70b-versatile";

    const { scorecard } = await runSuiteForModel(suite, targetModel);
    scorecard.skillName = skillName;

    return NextResponse.json({
      success: true,
      data: scorecard,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Benchmark execution failed",
      },
      { status: 500 }
    );
  }
}
