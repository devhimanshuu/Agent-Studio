/**
 * Server-only benchmark execution helpers — actually calls a real LLM provider
 * for each test case (no fabricated results). Kept out of benchmarkEngine.ts
 * because that module is also imported client-side and must stay provider-free.
 */
import { getProviderForModel } from "@/providers/llm";
import { findModelEntry } from "@/providers/llm/modelLists";
import { BenchmarkSuite, ModelBenchmarkComparisonItem, TestCaseResult } from "@/types/benchmark";
import { evaluateTestCase, generateScorecard } from "./benchmarkEngine";

export interface SuiteRunResult {
  scorecard: ReturnType<typeof generateScorecard>;
  avgLatencyMs: number;
  costPer1kRuns: number;
}

/**
 * Runs every test case in a suite against one real model and scores the
 * actual output/latency/tokens — the same execution path as /api/benchmarks/run.
 */
export async function runSuiteForModel(suite: BenchmarkSuite, modelId: string): Promise<SuiteRunResult> {
  const llm = getProviderForModel(modelId);
  const testResults: TestCaseResult[] = [];
  const suiteStarted = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

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
          { role: "user", content: promptText },
        ],
        { temperature: 0.1, maxTokens: 500 }
      );

      actualOutput = completion.content;
      const inputTok = completion.usage?.inputTokens ?? Math.round(promptText.length / 4);
      const outputTok = completion.usage?.outputTokens ?? Math.round(actualOutput.length / 4);
      totalInputTokens += inputTok;
      totalOutputTokens += outputTok;
      tokensUsed = inputTok + outputTok;
    } catch (err) {
      actualOutput = `Error: ${err instanceof Error ? err.message : String(err)}`;
      tokensUsed = 50;
    }

    const durationMs = Date.now() - testStarted;
    testResults.push(evaluateTestCase(testCase, actualOutput, durationMs, tokensUsed));
  }

  const totalDurationMs = Date.now() - suiteStarted;
  const scorecard = generateScorecard(suite, testResults, "Model Comparison", modelId, totalDurationMs);

  const avgLatencyMs = Math.round(
    testResults.reduce((acc, r) => acc + r.durationMs, 0) / Math.max(1, testResults.length)
  );

  // Real cost projection from this model's actual published per-token price
  // (findModelEntry) and the tokens actually consumed — $0 for free-tier models,
  // which is every model this app currently ships, rather than a guessed number.
  const modelEntry = findModelEntry(modelId);
  const inputPrice = modelEntry?.inputPrice ?? 0;
  const outputPrice = modelEntry?.outputPrice ?? 0;
  const costPer1kRuns =
    Math.round(((totalInputTokens * inputPrice + totalOutputTokens * outputPrice) / 1_000_000) * 1000 * 100) / 100;

  return { scorecard, avgLatencyMs, costPer1kRuns };
}

/**
 * Runs one suite against several real models and returns a genuinely measured
 * comparison — replaces the previous hardcoded GPT-4o/Claude/Gemini baseline
 * table, which never executed anything.
 */
export async function runModelComparison(
  suite: BenchmarkSuite,
  modelIds: string[]
): Promise<ModelBenchmarkComparisonItem[]> {
  const items: ModelBenchmarkComparisonItem[] = [];

  for (const modelId of modelIds) {
    const modelEntry = findModelEntry(modelId);
    const modelName = modelEntry?.label || modelId;
    const provider = modelEntry?.provider || "unknown";

    try {
      const { scorecard, avgLatencyMs, costPer1kRuns } = await runSuiteForModel(suite, modelId);

      const dims: Array<[string, number]> = [
        ["accuracy", scorecard.radar.accuracyScore],
        ["tool precision", scorecard.radar.toolPrecisionScore],
        ["latency efficiency", scorecard.radar.latencyScore],
        ["cost efficiency", scorecard.radar.costEfficiencyScore],
        ["safety compliance", scorecard.radar.safetyComplianceScore],
        ["multi-agent cohesion", scorecard.radar.multiAgentCohesionScore],
      ];
      const sorted = [...dims].sort((a, b) => b[1] - a[1]);

      items.push({
        modelName,
        provider,
        overallScore: scorecard.overallScore,
        passRate: scorecard.passRate,
        avgLatencyMs,
        costPer1kRuns,
        grade: scorecard.grade,
        strengths: sorted.slice(0, 2).map(([name, score]) => `${name} (${score}%)`),
        weaknesses: sorted
          .slice(-2)
          .filter(([, score]) => score < 85)
          .map(([name, score]) => `${name} (${score}%)`),
      });
    } catch (err) {
      items.push({
        modelName,
        provider,
        overallScore: 0,
        passRate: 0,
        avgLatencyMs: 0,
        costPer1kRuns: 0,
        grade: "F",
        strengths: [],
        weaknesses: [`Benchmark run failed: ${err instanceof Error ? err.message : "unknown error"}`],
      });
    }
  }

  return items.sort((a, b) => b.overallScore - a.overallScore);
}
