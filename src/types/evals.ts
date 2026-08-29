/**
 * MLOps Automated Evaluation & LLM-as-a-Judge System Types
 */

export type EvalMetricType =
  | "FAITHFULNESS"
  | "ANSWER_RELEVANCE"
  | "SEMANTIC_CORRECTNESS"
  | "CONTEXT_PRECISION"
  | "SAFETY_POLICY"
  | "TOOL_ACCURACY";

export type EvalTargetType = "GRAPH" | "SKILL" | "MODEL";

export type EvalRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface EvalDatasetItem {
  id: string;
  input: Record<string, unknown>;
  groundTruth?: string;
  context?: string | string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface EvalDataset {
  id: string;
  name: string;
  description: string;
  category: string;
  targetType: EvalTargetType;
  items: EvalDatasetItem[];
  createdAt: string;
  updatedAt: string;
}

export interface EvalMetricJudgeResult {
  metric: EvalMetricType;
  score: number; // 0.0 to 1.0
  passed: boolean;
  reasoning: string; // Chain-of-Thought explanation from Judge
}

export interface EvalItemVerdict {
  id: string;
  datasetItemId: string;
  input: Record<string, unknown>;
  output: string;
  groundTruth?: string;
  context?: string | string[];
  durationMs: number;
  tokensUsed: number;
  overallScore: number; // 0.0 to 1.0
  passed: boolean;
  metrics: Record<EvalMetricType, EvalMetricJudgeResult>;
  error?: string;
}

export interface EvalMetricSummary {
  metric: EvalMetricType;
  averageScore: number; // 0.0 to 1.0
  passRate: number; // 0 - 100%
  threshold: number;
}

export interface EvalRunSummary {
  overallScore: number; // 0 - 100
  passRate: number; // 0 - 100%
  totalItems: number;
  passedItems: number;
  failedItems: number;
  avgLatencyMs: number;
  p90LatencyMs: number;
  totalTokens: number;
  estimatedCostUsd: number;
  metricSummaries: Record<EvalMetricType, EvalMetricSummary>;
}

export interface EvalJudgeConfig {
  judgeModel: string;
  temperature?: number;
  metrics: EvalMetricType[];
  passThreshold?: number; // default 0.8 (80%)
  customInstructions?: string;
}

export interface EvalRunReport {
  id: string;
  name: string;
  datasetId: string;
  datasetName: string;
  targetType: EvalTargetType;
  targetId: string;
  targetName: string;
  judgeConfig: EvalJudgeConfig;
  status: EvalRunStatus;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  summary: EvalRunSummary;
  verdicts: EvalItemVerdict[];
  regressionAlerts: string[];
}

export interface EvalRunComparisonReport {
  runA: EvalRunReport;
  runB: EvalRunReport;
  overallDelta: number; // runB - runA
  passRateDelta: number;
  latencyDeltaMs: number;
  metricDeltas: Record<EvalMetricType, number>;
  regressedItemCount: number;
  improvedItemCount: number;
  keyFindings: string[];
}
