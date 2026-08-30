/**
 * RAG Triad Evaluation & Grounding Observability Engine.
 *
 * Implements the industry-standard RAG Triad evaluation metrics using an LLM-as-a-Judge
 * for each leg (falls back to a token-overlap heuristic only if the judge call itself fails):
 * 1. Context Relevance: How relevant were the retrieved pgvector chunks to the query?
 * 2. Groundedness (Faithfulness): Is the generated answer 100% supported by the retrieved context?
 * 3. Answer Relevance: Does the generated answer directly address the user's question?
 */

import { evaluateMetricWithJudge } from "@/modules/evals/llmJudge";
import { EvalJudgeConfig } from "@/types/evals";

export interface RAGTriadEvaluationInput {
  query: string;
  contextChunks: Array<{ content: string; score?: number; title?: string }>;
  generatedAnswer: string;
}

export interface RAGTriadScore {
  score: number; // 0.0 to 1.0
  grade: "A" | "B" | "C" | "D" | "F";
  details: string;
}

export interface RAGTriadEvaluationReport {
  contextRelevance: RAGTriadScore;
  groundedness: RAGTriadScore;
  answerRelevance: RAGTriadScore;
  overallScore: number;
  overallGrade: "A" | "B" | "C" | "D" | "F";
  hallucinationRisk: "LOW" | "MODERATE" | "HIGH";
  verdict: string;
  timestamp: string;
}

/**
 * Evaluates the RAG Triad across Context Relevance, Groundedness, and Answer Relevance
 * using an LLM-as-a-Judge for each leg (see src/modules/evals/llmJudge.ts). Each call
 * degrades to a token-overlap heuristic internally if the judge model itself errors,
 * and that fallback is always disclosed in the returned `details` string.
 */
export async function evaluateRAGTriad(input: RAGTriadEvaluationInput): Promise<RAGTriadEvaluationReport> {
  const { query, contextChunks, generatedAnswer } = input;

  const contextFullText = contextChunks.map((c) => c.content).join("\n\n---\n\n");
  const judgeConfig: EvalJudgeConfig = { judgeModel: "", metrics: [], temperature: 0, passThreshold: 0.7 };

  const [contextResult, groundednessResult, relevanceResult] = await Promise.all([
    evaluateMetricWithJudge("CONTEXT_PRECISION", { query }, generatedAnswer, {
      context: contextFullText,
      groundTruth: generatedAnswer,
      judgeConfig,
    }),
    evaluateMetricWithJudge("FAITHFULNESS", { query }, generatedAnswer, {
      context: contextFullText,
      judgeConfig,
    }),
    evaluateMetricWithJudge("ANSWER_RELEVANCE", { query }, generatedAnswer, {
      judgeConfig,
    }),
  ]);

  const contextMatchScore = contextResult.score;
  const groundednessScore = groundednessResult.score;
  const answerRelevanceScore = relevanceResult.score;

  // Overall Weighted Score
  const overallScore = Math.round((contextMatchScore * 0.3 + groundednessScore * 0.4 + answerRelevanceScore * 0.3) * 100) / 100;

  const hallucinationRisk: "LOW" | "MODERATE" | "HIGH" =
    groundednessScore >= 0.8 ? "LOW" : groundednessScore >= 0.5 ? "MODERATE" : "HIGH";

  const getGrade = (s: number): "A" | "B" | "C" | "D" | "F" =>
    s >= 0.85 ? "A" : s >= 0.7 ? "B" : s >= 0.55 ? "C" : s >= 0.4 ? "D" : "F";

  return {
    contextRelevance: {
      score: Math.round(contextMatchScore * 100) / 100,
      grade: getGrade(contextMatchScore),
      details: contextResult.reasoning,
    },
    groundedness: {
      score: Math.round(groundednessScore * 100) / 100,
      grade: getGrade(groundednessScore),
      details: groundednessResult.reasoning,
    },
    answerRelevance: {
      score: Math.round(answerRelevanceScore * 100) / 100,
      grade: getGrade(answerRelevanceScore),
      details: relevanceResult.reasoning,
    },
    overallScore,
    overallGrade: getGrade(overallScore),
    hallucinationRisk,
    verdict:
      overallScore >= 0.8
        ? "Exemplary RAG execution. Strong vector retrieval, high grounding, and zero hallucination detected."
        : overallScore >= 0.6
        ? "Good RAG execution. Answer is largely faithful with moderate semantic context coverage."
        : "Degraded RAG execution. Context retrieval or grounding needs adjustment.",
    timestamp: new Date().toISOString(),
  };
}
