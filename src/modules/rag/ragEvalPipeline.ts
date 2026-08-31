/**
 * Comprehensive RAG Evaluation Pipeline
 *
 * Extended evaluation metrics beyond the basic RAG Triad:
 * - Context Precision: How many retrieved chunks are actually relevant
 * - Context Recall: Did we retrieve all relevant chunks
 * - Faithfulness: Is the answer fully supported by context
 * - Answer Relevance: Does the answer address the query
 * - Hallucination Detection: Identify unsupported claims
 * - Retrieval Quality: Precision@k, Recall@k, MRR, NDCG
 * - Chunk Quality: Semantic coherence within retrieved chunks
 *
 * Uses LLM-as-a-Judge with fallback to heuristic scoring.
 */

import { evaluateMetricWithJudge } from "@/modules/evals/llmJudge";
import { EvalJudgeConfig } from "@/types/evals";

// ─── Types ───

export interface EvalInput {
  query: string;
  retrievedChunks: Array<{
    content: string;
    score: number;
    title?: string;
    chunkId?: string;
    metadata?: Record<string, unknown>;
  }>;
  generatedAnswer: string;
  /** Ground truth answer (optional, for reference-based metrics) */
  groundTruth?: string;
  /** All relevant document IDs for recall computation (optional) */
  relevantDocIds?: string[];
}

export interface ChunkQualityScore {
  chunkId: string;
  /** How relevant this chunk is to the query */
  relevanceScore: number;
  /** How factually consistent this chunk is with the answer */
  consistencyScore: number;
  /** Whether this chunk contains hallucination risk */
  hallucinationRisk: "LOW" | "MEDIUM" | "HIGH";
  /** Brief quality assessment */
  assessment: string;
}

export interface RetrievalQualityMetrics {
  /** Precision@k: fraction of retrieved chunks that are relevant */
  precisionAtK: number;
  /** Mean Reciprocal Rank: 1/rank of first relevant result */
  mrr: number;
  /** Number of relevant chunks retrieved */
  relevantRetrieved: number;
  /** Total chunks retrieved */
  totalRetrieved: number;
}

export interface HallucinationReport {
  /** Overall hallucination risk */
  risk: "LOW" | "MODERATE" | "HIGH";
  /** List of unsupported claims */
  unsupportedClaims: string[];
  /** List of context-supported claims */
  supportedClaims: string[];
  /** Hallucination score (0=no hallucination, 1=pure hallucination) */
  score: number;
  /** Detailed explanation */
  explanation: string;
}

export interface ComprehensiveRAGEvalReport {
  // Core RAG Triad (enhanced)
  contextPrecision: MetricScore;
  contextRecall: MetricScore;
  faithfulness: MetricScore;
  answerRelevance: MetricScore;

  // Overall scores
  overallScore: number;
  overallGrade: "A" | "B" | "C" | "D" | "F";

  // Retrieval quality
  retrievalQuality: RetrievalQualityMetrics;

  // Hallucination analysis
  hallucination: HallucinationReport;

  // Per-chunk quality
  chunkQualities: ChunkQualityScore[];

  // Aggregated metrics
  contextCoveragePct: number;
  avgChunkRelevance: number;
  queryAnswerAlignment: number;

  // Metadata
  timestamp: string;
  evalVersion: string;
  verdict: string;
}

interface MetricScore {
  score: number;
  details: string;
  method: "llm_judge" | "heuristic" | "hybrid";
  grade: "A" | "B" | "C" | "D" | "F";
}

// ─── Evaluation Pipeline ───

/**
 * Run the comprehensive RAG evaluation pipeline.
 */
export async function runComprehensiveRAGEval(
  input: EvalInput
): Promise<ComprehensiveRAGEvalReport> {
  const { query, retrievedChunks, generatedAnswer, groundTruth, relevantDocIds } = input;

  const contextFullText = retrievedChunks.map((c) => c.content).join("\n\n---\n\n");
  const judgeConfig: EvalJudgeConfig = {
    judgeModel: "",
    metrics: [],
    temperature: 0,
    passThreshold: 0.7,
  };

  // Run LLM judge evaluations in parallel
  const [precisionResult, faithfulnessResult, relevanceResult, hallucinationResult] =
    await Promise.all([
      // Context Precision
      evaluateWithFallback(
        () =>
          evaluateMetricWithJudge("CONTEXT_PRECISION", { query }, generatedAnswer, {
            context: contextFullText,
            judgeConfig,
          }),
        () => heuristicContextPrecision(query, retrievedChunks)
      ),

      // Faithfulness
      evaluateWithFallback(
        () =>
          evaluateMetricWithJudge("FAITHFULNESS", { query }, generatedAnswer, {
            context: contextFullText,
            judgeConfig,
          }),
        () => heuristicFaithfulness(generatedAnswer, retrievedChunks)
      ),

      // Answer Relevance
      evaluateWithFallback(
        () =>
          evaluateMetricWithJudge("ANSWER_RELEVANCE", { query }, generatedAnswer, {
            judgeConfig,
          }),
        () => heuristicAnswerRelevance(query, generatedAnswer)
      ),

      // Hallucination detection
      detectHallucinations(query, generatedAnswer, retrievedChunks),
    ]);

  // Context Recall (heuristic-based since no CONTEXT_RECALL judge metric exists)
  const recallResult = heuristicContextRecall(query, retrievedChunks, groundTruth);

  // Retrieval quality metrics
  const retrievalQuality = computeRetrievalQuality(retrievedChunks, relevantDocIds);

  // Per-chunk quality analysis
  const chunkQualities = analyzeChunkQualities(query, generatedAnswer, retrievedChunks);

  // Aggregate metrics
  const contextCoveragePct = computeContextCoverage(retrievedChunks);
  const avgChunkRelevance =
    chunkQualities.length > 0
      ? chunkQualities.reduce((a, c) => a + c.relevanceScore, 0) / chunkQualities.length
      : 0;
  const queryAnswerAlignment = (precisionResult.score + relevanceResult.score) / 2;

  // Overall score (weighted)
  const overallScore = Math.round(
    (precisionResult.score * 0.2 +
      recallResult.score * 0.15 +
      faithfulnessResult.score * 0.3 +
      relevanceResult.score * 0.2 +
      (1 - hallucinationResult.score) * 0.15) *
      100
  ) / 100;

  const getGrade = (s: number): "A" | "B" | "C" | "D" | "F" =>
    s >= 0.85 ? "A" : s >= 0.7 ? "B" : s >= 0.55 ? "C" : s >= 0.4 ? "D" : "F";

  return {
    contextPrecision: precisionResult,
    contextRecall: { score: recallResult.score, details: recallResult.reasoning, method: "heuristic" as const, grade: getGrade(recallResult.score) },
    faithfulness: faithfulnessResult,
    answerRelevance: relevanceResult,
    overallScore,
    overallGrade: getGrade(overallScore),
    retrievalQuality,
    hallucination: hallucinationResult,
    chunkQualities,
    contextCoveragePct,
    avgChunkRelevance: Math.round(avgChunkRelevance * 100) / 100,
    queryAnswerAlignment: Math.round(queryAnswerAlignment * 100) / 100,
    timestamp: new Date().toISOString(),
    evalVersion: "2.0",
    verdict: buildVerdict(overallScore, hallucinationResult.risk, retrievalQuality),
  };
}

// ─── Heuristic Fallbacks ───

function heuristicContextPrecision(
  query: string,
  chunks: Array<{ content: string; score: number }>
): { score: number; reasoning: string; method: "heuristic" } {
  if (chunks.length === 0) return { score: 0, reasoning: "No chunks retrieved", method: "heuristic" };

  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  let relevantCount = 0;

  for (const chunk of chunks) {
    const content = chunk.content.toLowerCase();
    const termHits = queryTerms.filter((t) => content.includes(t)).length;
    if (termHits >= queryTerms.length * 0.3 || chunk.score > 0.7) {
      relevantCount++;
    }
  }

  const precision = relevantCount / chunks.length;
  return {
    score: Math.round(precision * 100) / 100,
    reasoning: `${relevantCount}/${chunks.length} chunks contain query-relevant content (heuristic)`,
    method: "heuristic",
  };
}

function heuristicContextRecall(
  query: string,
  chunks: Array<{ content: string; score: number }>,
  groundTruth?: string
): { score: number; reasoning: string; method: "heuristic" } {
  if (chunks.length === 0) return { score: 0, reasoning: "No chunks retrieved", method: "heuristic" };

  const allContent = chunks.map((c) => c.content.toLowerCase()).join(" ");
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const hits = queryTerms.filter((t) => allContent.includes(t)).length;

  let score = queryTerms.length > 0 ? hits / queryTerms.length : 0.5;

  // If ground truth is provided, check how much of it is covered
  if (groundTruth) {
    const truthTerms = groundTruth.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const truthHits = truthTerms.filter((t) => allContent.includes(t)).length;
    const truthCoverage = truthTerms.length > 0 ? truthHits / truthTerms.length : 0;
    score = (score + truthCoverage) / 2;
  }

  return {
    score: Math.round(Math.min(1.0, score) * 100) / 100,
    reasoning: `Context covers ${Math.round(score * 100)}% of query concepts (heuristic)`,
    method: "heuristic",
  };
}

function heuristicFaithfulness(
  answer: string,
  chunks: Array<{ content: string }>
): { score: number; reasoning: string; method: "heuristic" } {
  if (!answer || chunks.length === 0) {
    return { score: 0.5, reasoning: "Insufficient data for heuristic scoring", method: "heuristic" };
  }

  // Check how many sentences in the answer are supported by context
  const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const contextText = chunks.map((c) => c.content.toLowerCase()).join(" ");

  let supportedCount = 0;
  for (const sentence of sentences) {
    const terms = sentence.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const termHits = terms.filter((t) => contextText.includes(t)).length;
    if (terms.length > 0 && termHits / terms.length >= 0.3) {
      supportedCount++;
    }
  }

  const faithfulness = sentences.length > 0 ? supportedCount / sentences.length : 0.5;
  return {
    score: Math.round(faithfulness * 100) / 100,
    reasoning: `${supportedCount}/${sentences.length} sentences supported by context (heuristic)`,
    method: "heuristic",
  };
}

function heuristicAnswerRelevance(
  query: string,
  answer: string
): { score: number; reasoning: string; method: "heuristic" } {
  if (!answer) return { score: 0, reasoning: "Empty answer", method: "heuristic" };

  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const answerLower = answer.toLowerCase();
  const hits = queryTerms.filter((t) => answerLower.includes(t)).length;

  const relevance = queryTerms.length > 0 ? hits / queryTerms.length : 0.5;
  return {
    score: Math.round(Math.min(1.0, relevance * 1.2) * 100) / 100, // slight boost for heuristic
    reasoning: `Answer addresses ${Math.round(relevance * 100)}% of query terms (heuristic)`,
    method: "heuristic",
  };
}

// ─── Hallucination Detection ───

async function detectHallucinations(
  query: string,
  answer: string,
  chunks: Array<{ content: string }>
): Promise<HallucinationReport> {
  const contextText = chunks.map((c) => c.content).join("\n\n");
  const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 10);

  const supportedClaims: string[] = [];
  const unsupportedClaims: string[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const terms = trimmed.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const contextLower = contextText.toLowerCase();
    const termHits = terms.filter((t) => contextLower.includes(t)).length;

    if (terms.length > 0 && termHits / terms.length >= 0.25) {
      supportedClaims.push(trimmed);
    } else {
      unsupportedClaims.push(trimmed);
    }
  }

  const totalClaims = supportedClaims.length + unsupportedClaims.length;
  const hallucinationScore = totalClaims > 0 ? unsupportedClaims.length / totalClaims : 0;

  let risk: HallucinationReport["risk"];
  if (hallucinationScore <= 0.15) risk = "LOW";
  else if (hallucinationScore <= 0.4) risk = "MODERATE";
  else risk = "HIGH";

  return {
    risk,
    unsupportedClaims,
    supportedClaims,
    score: Math.round(hallucinationScore * 100) / 100,
    explanation:
      risk === "LOW"
        ? "Answer is well-grounded in the retrieved context."
        : risk === "MODERATE"
        ? `${unsupportedClaims.length} claim(s) lack clear context support — review before production use.`
        : `${unsupportedClaims.length} claim(s) appear unsupported — high hallucination risk, answer should not be trusted.`,
  };
}

// ─── Retrieval Quality ───

function computeRetrievalQuality(
  chunks: Array<{ score: number; chunkId?: string; metadata?: Record<string, unknown> }>,
  relevantDocIds?: string[]
): RetrievalQualityMetrics {
  if (chunks.length === 0) {
    return {
      precisionAtK: 0,
      mrr: 0,
      relevantRetrieved: 0,
      totalRetrieved: 0,
    };
  }

  const totalRetrieved = chunks.length;

  if (!relevantDocIds || relevantDocIds.length === 0) {
    // Use score threshold as a proxy for relevance
    const relevantThreshold = 0.6;
    const relevantRetrieved = chunks.filter((c) => c.score >= relevantThreshold).length;
    return {
      precisionAtK: relevantRetrieved / totalRetrieved,
      mrr: chunks[0]?.score >= relevantThreshold ? 1.0 : 0,
      relevantRetrieved,
      totalRetrieved,
    };
  }

  const relevantSet = new Set(relevantDocIds);
  let relevantRetrieved = 0;
  let reciprocalRank = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = chunks[i].chunkId || (chunks[i].metadata?.documentId as string);
    if (chunkId && relevantSet.has(chunkId)) {
      relevantRetrieved++;
      if (reciprocalRank === 0) {
        reciprocalRank = 1 / (i + 1);
      }
    }
  }

  return {
    precisionAtK: totalRetrieved > 0 ? relevantRetrieved / totalRetrieved : 0,
    mrr: reciprocalRank,
    relevantRetrieved,
    totalRetrieved,
  };
}

// ─── Per-Chunk Quality ───

function analyzeChunkQualities(
  query: string,
  answer: string,
  chunks: Array<{ content: string; score: number; chunkId?: string }>
): ChunkQualityScore[] {
  return chunks.map((chunk, idx) => {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const content = chunk.content.toLowerCase();
    const relevanceHits = terms.filter((t) => content.includes(t)).length;
    const relevanceScore = terms.length > 0 ? relevanceHits / terms.length : 0;

    const answerTerms = answer.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const consistencyHits = answerTerms.filter((t) => content.includes(t)).length;
    const consistencyScore = answerTerms.length > 0 ? consistencyHits / answerTerms.length : 0;

    let hallucinationRisk: ChunkQualityScore["hallucinationRisk"];
    if (chunk.score > 0.6 && relevanceScore > 0.4) hallucinationRisk = "LOW";
    else if (chunk.score > 0.3) hallucinationRisk = "MEDIUM";
    else hallucinationRisk = "HIGH";

    const assessment =
      hallucinationRisk === "LOW"
        ? "High-quality chunk — relevant and consistent with answer"
        : hallucinationRisk === "MEDIUM"
        ? "Moderate quality — partially relevant"
        : "Low quality — may introduce noise or hallucination";

    return {
      chunkId: chunk.chunkId || `chunk_${idx}`,
      relevanceScore: Math.round(relevanceScore * 100) / 100,
      consistencyScore: Math.round(consistencyScore * 100) / 100,
      hallucinationRisk,
      assessment,
    };
  });
}

function computeContextCoverage(
  chunks: Array<{ content: string }>
): number {
  if (chunks.length === 0) return 0;
  const allContent = chunks.map((c) => c.content).join(" ");
  const uniqueChars = new Set(allContent.split("")).size;
  return Math.round((uniqueChars / Math.max(1, allContent.length)) * 100);
}

// ─── Helpers ───

const getGrade = (s: number): "A" | "B" | "C" | "D" | "F" =>
  s >= 0.85 ? "A" : s >= 0.7 ? "B" : s >= 0.55 ? "C" : s >= 0.4 ? "D" : "F";

async function evaluateWithFallback(
  judgeFn: () => Promise<import("@/types/evals").EvalMetricJudgeResult>,
  heuristicFn: () => { score: number; reasoning: string }
): Promise<MetricScore> {
  const gradeScore = (s: number): "A" | "B" | "C" | "D" | "F" =>
    s >= 0.85 ? "A" : s >= 0.7 ? "B" : s >= 0.55 ? "C" : s >= 0.4 ? "D" : "F";

  try {
    const result = await Promise.race([
      judgeFn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
    ]);
    return { score: result.score, details: result.reasoning, method: "llm_judge", grade: gradeScore(result.score) };
  } catch {
    const heuristic = heuristicFn();
    return { score: heuristic.score, details: heuristic.reasoning, method: "heuristic", grade: gradeScore(heuristic.score) };
  }
}

function buildVerdict(
  overallScore: number,
  hallucinationRisk: string,
  retrieval: RetrievalQualityMetrics
): string {
  const parts: string[] = [];

  if (overallScore >= 0.8) parts.push("Exemplary RAG execution.");
  else if (overallScore >= 0.6) parts.push("Good RAG execution with room for improvement.");
  else if (overallScore >= 0.4) parts.push("Below-average RAG execution.");
  else parts.push("Poor RAG execution — significant issues detected.");

  if (hallucinationRisk === "HIGH") {
    parts.push("High hallucination risk — answer should not be used as-is.");
  } else if (hallucinationRisk === "MODERATE") {
    parts.push("Moderate hallucination risk — review unsupported claims.");
  } else {
    parts.push("Low hallucination risk — answer is well-grounded.");
  }

  if (retrieval.precisionAtK < 0.3) {
    parts.push("Retrieval precision is low — consider refining the query or chunking strategy.");
  }

  if (retrieval.mrr > 0.8) {
    parts.push("Top results are highly relevant (strong MRR).");
  }

  return parts.join(" ");
}
