import { NextRequest, NextResponse } from "next/server";
import { runAutomatedEvaluation } from "@/modules/evals/evalRunner";
import { EvalJudgeConfig, EvalMetricType, EvalTargetType } from "@/types/evals";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      datasetId,
      targetType = "GRAPH" as EvalTargetType,
      targetId = "default_target",
      targetName = "Agent Mission Control Graph",
      targetModel = "meta-llama/llama-3.3-70b-versatile",
      judgeConfig = {} as Partial<EvalJudgeConfig>,
    } = body;

    if (!datasetId) {
      return NextResponse.json(
        { success: false, error: "'datasetId' parameter is required to run evaluation." },
        { status: 400 }
      );
    }

    const defaultMetrics: EvalMetricType[] = [
      "FAITHFULNESS",
      "ANSWER_RELEVANCE",
      "SEMANTIC_CORRECTNESS",
      "SAFETY_POLICY",
    ];

    const finalJudgeConfig: EvalJudgeConfig = {
      judgeModel: judgeConfig.judgeModel || "meta-llama/llama-3.3-70b-versatile",
      temperature: judgeConfig.temperature ?? 0.0,
      metrics: judgeConfig.metrics && judgeConfig.metrics.length > 0 ? judgeConfig.metrics : defaultMetrics,
      passThreshold: judgeConfig.passThreshold ?? 0.75,
      customInstructions: judgeConfig.customInstructions,
    };

    const report = await runAutomatedEvaluation({
      datasetId,
      targetType,
      targetId,
      targetName,
      targetModel,
      judgeConfig: finalJudgeConfig,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Evaluation execution failed",
      },
      { status: 500 }
    );
  }
}
