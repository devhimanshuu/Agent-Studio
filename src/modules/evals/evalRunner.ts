import {
  EvalDataset,
  EvalDatasetItem,
  EvalRunReport,
  EvalJudgeConfig,
  EvalItemVerdict,
  EvalMetricType,
  EvalMetricSummary,
  EvalRunSummary,
  EvalRunComparisonReport,
  EvalTargetType,
} from "@/types/evals";
import { getEvalDatasetById } from "./datasetStore";
import { evaluateMetricWithJudge } from "./llmJudge";
import { getProviderForModel, getLLMProvider } from "@/providers/llm";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ensureUserExists } from "@/lib/user";

/**
 * Persisted evaluation run history (Postgres via Prisma) — previously an
 * in-memory Map, so run history vanished on every server restart/cold start.
 */
export async function listEvalReports(userId?: string): Promise<EvalRunReport[]> {
  const rows = await prisma.evalRunReport.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { startedAt: "desc" },
  });
  return rows.map((r) => r.data as unknown as EvalRunReport);
}

export async function getEvalReportById(id: string, userId?: string): Promise<EvalRunReport | undefined> {
  const row = await prisma.evalRunReport.findFirst({ where: userId ? { id, userId } : { id } });
  return row ? (row.data as unknown as EvalRunReport) : undefined;
}

export async function runAutomatedEvaluation(params: {
  datasetId: string;
  targetType: EvalTargetType;
  targetId: string;
  targetName: string;
  targetModel?: string;
  judgeConfig: EvalJudgeConfig;
  userId?: string;
}): Promise<EvalRunReport> {
  const dataset = getEvalDatasetById(params.datasetId);
  if (!dataset) {
    throw new Error(`Dataset with ID '${params.datasetId}' not found.`);
  }

  const runId = `eval_run_${Date.now()}`;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  const targetModel = params.targetModel || "meta-llama/llama-3.3-70b-versatile";
  const llm = targetModel ? getProviderForModel(targetModel) : getLLMProvider();

  const verdicts: EvalItemVerdict[] = [];
  const latencies: number[] = [];
  let totalTokens = 0;

  for (const item of dataset.items) {
    const itemStart = Date.now();
    let actualOutput = "";
    let itemTokens = 0;

    try {
      const promptText = typeof item.input === "string" ? item.input : JSON.stringify(item.input);
      const systemInstruction = item.context
        ? `You are an enterprise AI agent. Answer strictly using this context:\n"""${
            Array.isArray(item.context) ? item.context.join("\n") : item.context
          }"""`
        : "You are an enterprise AI agent. Provide an accurate, grounded, and concise response.";

      const completion = await llm.complete(
        [
          { role: "system", content: systemInstruction },
          { role: "user", content: promptText },
        ],
        { temperature: 0.1, maxTokens: 600 }
      );

      actualOutput = completion.content;
      itemTokens =
        (completion.usage?.inputTokens ?? Math.round(promptText.length / 4)) +
        (completion.usage?.outputTokens ?? Math.round(actualOutput.length / 4));
    } catch (err) {
      actualOutput = `Error: ${err instanceof Error ? err.message : String(err)}`;
      itemTokens = 50;
    }

    const durationMs = Date.now() - itemStart;
    latencies.push(durationMs);
    totalTokens += itemTokens;

    // Evaluate metrics with LLM-as-a-Judge
    const metricResults: Record<EvalMetricType, any> = {} as any;
    let itemWeightedScoreSum = 0;
    let itemPassed = true;

    for (const metric of params.judgeConfig.metrics) {
      const result = await evaluateMetricWithJudge(metric, item.input, actualOutput, {
        context: item.context,
        groundTruth: item.groundTruth,
        judgeConfig: params.judgeConfig,
      });

      metricResults[metric] = result;
      itemWeightedScoreSum += result.score;
      if (!result.passed) {
        itemPassed = false;
      }
    }

    const overallItemScore =
      params.judgeConfig.metrics.length > 0
        ? Math.round((itemWeightedScoreSum / params.judgeConfig.metrics.length) * 100) / 100
        : 1.0;

    verdicts.push({
      id: `verdict_${item.id}_${Date.now()}`,
      datasetItemId: item.id,
      input: item.input,
      output: actualOutput,
      groundTruth: item.groundTruth,
      context: item.context,
      durationMs,
      tokensUsed: itemTokens,
      overallScore: overallItemScore,
      passed: itemPassed,
      metrics: metricResults,
    });
  }

  const durationMs = Date.now() - startTime;
  const completedAt = new Date().toISOString();

  // Compute Run Summary & Percentiles
  latencies.sort((a, b) => a - b);
  const avgLatencyMs = Math.round(latencies.reduce((acc, l) => acc + l, 0) / Math.max(1, latencies.length));
  const p90Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.9));
  const p90LatencyMs = latencies[p90Index] || avgLatencyMs;

  const passedItems = verdicts.filter((v) => v.passed).length;
  const failedItems = verdicts.length - passedItems;
  const passRate = verdicts.length > 0 ? Math.round((passedItems / verdicts.length) * 100) : 100;
  const overallScore =
    verdicts.length > 0
      ? Math.round((verdicts.reduce((acc, v) => acc + v.overallScore, 0) / verdicts.length) * 100)
      : 100;

  const estimatedCostUsd = Math.round((totalTokens / 1_000_000) * 0.4 * 1000) / 1000;

  // Aggregate Metrics Summary
  const metricSummaries: Record<EvalMetricType, EvalMetricSummary> = {} as any;
  for (const metric of params.judgeConfig.metrics) {
    const metricScores = verdicts.map((v) => v.metrics[metric]?.score ?? 1.0);
    const metricPassCount = verdicts.filter((v) => v.metrics[metric]?.passed).length;
    const avgScore =
      metricScores.length > 0
        ? Math.round((metricScores.reduce((a, b) => a + b, 0) / metricScores.length) * 100) / 100
        : 1.0;
    const metricPassRate =
      verdicts.length > 0 ? Math.round((metricPassCount / verdicts.length) * 100) : 100;

    metricSummaries[metric] = {
      metric,
      averageScore: avgScore,
      passRate: metricPassRate,
      threshold: params.judgeConfig.passThreshold ?? 0.75,
    };
  }

  // Regression & Quality Alerts
  const regressionAlerts: string[] = [];
  if (metricSummaries["FAITHFULNESS"] && metricSummaries["FAITHFULNESS"].averageScore < 0.85) {
    regressionAlerts.push("⚠️ Low Faithfulness Score: Output contains assertions not verified in retrieved context.");
  }
  if (metricSummaries["SEMANTIC_CORRECTNESS"] && metricSummaries["SEMANTIC_CORRECTNESS"].averageScore < 0.8) {
    regressionAlerts.push("⚠️ Semantic Drift: Output diverges from golden reference ground truth.");
  }
  if (p90LatencyMs > 4000) {
    regressionAlerts.push("⚠️ Latency SLA Warning: P90 latency exceeded 4,000ms threshold.");
  }

  const summary: EvalRunSummary = {
    overallScore,
    passRate,
    totalItems: verdicts.length,
    passedItems,
    failedItems,
    avgLatencyMs,
    p90LatencyMs,
    totalTokens,
    estimatedCostUsd,
    metricSummaries,
  };

  const report: EvalRunReport = {
    id: runId,
    name: `${dataset.name} Evaluation (${new Date().toLocaleTimeString()})`,
    datasetId: dataset.id,
    datasetName: dataset.name,
    targetType: params.targetType,
    targetId: params.targetId,
    targetName: params.targetName,
    judgeConfig: params.judgeConfig,
    status: "COMPLETED",
    startedAt,
    completedAt,
    durationMs,
    summary,
    verdicts,
    regressionAlerts,
  };

  if (params.userId) {
    await ensureUserExists(params.userId);
  }

  await prisma.evalRunReport.create({
    data: {
      id: runId,
      userId: params.userId ?? null,
      datasetId: dataset.id,
      datasetName: dataset.name,
      targetType: params.targetType,
      targetId: params.targetId,
      targetName: params.targetName,
      name: report.name,
      status: report.status,
      startedAt: new Date(startedAt),
      completedAt: new Date(completedAt),
      durationMs,
      overallScore,
      passRate,
      data: report as unknown as Prisma.InputJsonValue,
    },
  });

  return report;
}

export function compareEvaluationRuns(runA: EvalRunReport, runB: EvalRunReport): EvalRunComparisonReport {
  const overallDelta = runB.summary.overallScore - runA.summary.overallScore;
  const passRateDelta = runB.summary.passRate - runA.summary.passRate;
  const latencyDeltaMs = runB.summary.avgLatencyMs - runA.summary.avgLatencyMs;

  const metricDeltas: Record<EvalMetricType, number> = {} as any;
  for (const m of Object.keys(runB.summary.metricSummaries) as EvalMetricType[]) {
    const scoreA = runA.summary.metricSummaries[m]?.averageScore ?? 0;
    const scoreB = runB.summary.metricSummaries[m]?.averageScore ?? 0;
    metricDeltas[m] = Math.round((scoreB - scoreA) * 100) / 100;
  }

  let regressedCount = 0;
  let improvedCount = 0;

  for (const itemB of runB.verdicts) {
    const itemA = runA.verdicts.find((v) => v.datasetItemId === itemB.datasetItemId);
    if (itemA) {
      if (itemB.overallScore < itemA.overallScore - 0.05) {
        regressedCount++;
      } else if (itemB.overallScore > itemA.overallScore + 0.05) {
        improvedCount++;
      }
    }
  }

  const keyFindings: string[] = [];
  if (overallDelta > 0) {
    keyFindings.push(`📈 Overall Quality improved by +${overallDelta}% in the updated run.`);
  } else if (overallDelta < 0) {
    keyFindings.push(`📉 Overall Quality regressed by ${overallDelta}% in the updated run.`);
  }
  if (latencyDeltaMs < 0) {
    keyFindings.push(`⚡ Latency improved by ${Math.abs(latencyDeltaMs)}ms (faster response times).`);
  }

  return {
    runA,
    runB,
    overallDelta,
    passRateDelta,
    latencyDeltaMs,
    metricDeltas,
    regressedItemCount: regressedCount,
    improvedItemCount: improvedCount,
    keyFindings,
  };
}
