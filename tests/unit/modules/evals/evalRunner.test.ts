import { describe, it, expect } from "vitest";
import { runAutomatedEvaluation, compareEvaluationRuns } from "@/modules/evals/evalRunner";
import { listEvalDatasets } from "@/modules/evals/datasetStore";

describe("Automated Evaluation Pipeline Runner & Regression Suite", () => {
  it("loads built-in golden datasets", () => {
    const datasets = listEvalDatasets();
    expect(datasets.length).toBeGreaterThanOrEqual(4);
    expect(datasets.some((d) => d.id === "finance_rag_golden")).toBe(true);
    expect(datasets.some((d) => d.id === "adversarial_safety_golden")).toBe(true);
  });

  it("executes automated batch evaluation on a golden dataset", async () => {
    const report = await runAutomatedEvaluation({
      datasetId: "customer_support_policies",
      targetType: "SKILL",
      targetId: "support_agent_01",
      targetName: "Enterprise Tier-1 Support Agent",
      judgeConfig: {
        judgeModel: "meta-llama/llama-3.3-70b-versatile",
        metrics: ["FAITHFULNESS", "ANSWER_RELEVANCE", "SEMANTIC_CORRECTNESS"],
        passThreshold: 0.75,
      },
    });

    expect(report.id).toBeDefined();
    expect(report.status).toBe("COMPLETED");
    expect(report.verdicts.length).toBe(2);
    expect(report.summary.overallScore).toBeGreaterThan(0);
    expect(report.summary.passRate).toBeGreaterThanOrEqual(0);
    expect(report.summary.metricSummaries.FAITHFULNESS).toBeDefined();
  });

  it("compares two evaluation runs and identifies regression / improvement deltas", async () => {
    const runA = await runAutomatedEvaluation({
      datasetId: "finance_rag_golden",
      targetType: "GRAPH",
      targetId: "fin_v1",
      targetName: "Financial Analyst Graph v1.0",
      judgeConfig: {
        judgeModel: "meta-llama/llama-3.3-70b-versatile",
        metrics: ["FAITHFULNESS", "ANSWER_RELEVANCE"],
        passThreshold: 0.8,
      },
    });

    const runB = await runAutomatedEvaluation({
      datasetId: "finance_rag_golden",
      targetType: "GRAPH",
      targetId: "fin_v2",
      targetName: "Financial Analyst Graph v2.0 (Optimized)",
      judgeConfig: {
        judgeModel: "meta-llama/llama-3.3-70b-versatile",
        metrics: ["FAITHFULNESS", "ANSWER_RELEVANCE"],
        passThreshold: 0.8,
      },
    });

    const comparison = compareEvaluationRuns(runA, runB);
    expect(comparison.runA.id).toBe(runA.id);
    expect(comparison.runB.id).toBe(runB.id);
    expect(typeof comparison.overallDelta).toBe("number");
    expect(typeof comparison.passRateDelta).toBe("number");
    expect(comparison.keyFindings).toBeDefined();
  });
});
