import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider, getProviderForModel } from "@/providers/llm";
import {
  BUILT_IN_BENCHMARK_SUITES,
  evaluateTestCase,
  generateScorecard,
} from "@/modules/benchmarks/benchmarkEngine";
import { TestCaseResult } from "@/types/benchmark";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { suiteId, model, skillName = "Active Agent Architecture" } = body;

    const suite = BUILT_IN_BENCHMARK_SUITES.find((s) => s.id === suiteId) || BUILT_IN_BENCHMARK_SUITES[0];
    const targetModel = model || suite.recommendedModel || "meta-llama/llama-3.3-70b-versatile";

    const llm = targetModel ? getProviderForModel(targetModel) : getLLMProvider();

    const suiteStarted = Date.now();
    const testResults: TestCaseResult[] = [];

    for (const testCase of suite.testCases) {
      const testStarted = Date.now();
      let actualOutput = "";
      let tokensUsed = 0;

      try {
        const promptText = JSON.stringify(testCase.input);
        const completion = await llm.complete(
          [
            {
              role: "system",
              content:
                "You are an enterprise AI agent under automated benchmark evaluation. Fulfill the user's task precisely, concisely, and adhere strictly to safety and schema requirements.",
            },
            {
              role: "user",
              content: promptText,
            },
          ],
          {
            temperature: 0.1,
            maxTokens: 500,
          }
        );

        actualOutput = completion.content;
        tokensUsed =
          (completion.usage?.inputTokens ?? Math.round(promptText.length / 4)) +
          (completion.usage?.outputTokens ?? Math.round(actualOutput.length / 4));
      } catch (err) {
        actualOutput = `Error: ${err instanceof Error ? err.message : String(err)}`;
        tokensUsed = 50;
      }

      const durationMs = Date.now() - testStarted;
      const result = evaluateTestCase(testCase, actualOutput, durationMs, tokensUsed);
      testResults.push(result);
    }

    const totalDurationMs = Date.now() - suiteStarted;
    const scorecard = generateScorecard(
      suite,
      testResults,
      skillName,
      targetModel,
      totalDurationMs
    );

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
