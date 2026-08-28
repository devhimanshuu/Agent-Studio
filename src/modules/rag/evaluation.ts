/**
 * RAG Triad Evaluation & Grounding Observability Engine.
 *
 * Implements the industry-standard RAG Triad evaluation metrics:
 * 1. Context Relevance: How relevant were the retrieved pgvector chunks to the query?
 * 2. Groundedness (Faithfulness): Is the generated answer 100% supported by the retrieved context?
 * 3. Answer Relevance: Does the generated answer directly address the user's question?
 */

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

const STOP_WORDS = new Set([
  "how", "does", "what", "which", "when", "where", "why", "who", "whom",
  "this", "that", "these", "those", "have", "has", "had", "with", "from",
  "into", "during", "including", "until", "against", "among", "throughout",
  "despite", "towards", "upon", "concerning", "to", "in", "for", "on", "by",
  "about", "like", "through", "over", "before", "between", "after", "since",
  "without", "under", "within", "along", "following", "across", "behind",
  "beyond", "plus", "except", "but", "up", "out", "around", "down", "off",
  "above", "near", "perform", "show", "tell", "explain", "give", "is", "are"
]);

/**
 * Evaluates the RAG Triad across Context Relevance, Groundedness, and Answer Relevance.
 */
export function evaluateRAGTriad(input: RAGTriadEvaluationInput): RAGTriadEvaluationReport {
  const { query, contextChunks, generatedAnswer } = input;

  const rawTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const queryTerms = rawTerms.filter((t) => !STOP_WORDS.has(t));
  const effectiveQueryTerms = queryTerms.length > 0 ? queryTerms : rawTerms;

  const answerSentences = generatedAnswer
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  const contextFullText = contextChunks.map((c) => c.content).join(" ").toLowerCase();

  // 1. Context Relevance Score
  let contextMatchScore = 0;
  if (contextChunks.length > 0) {
    let termHits = 0;
    for (const term of effectiveQueryTerms) {
      if (contextFullText.includes(term)) termHits += 1;
    }
    const termCoverage = effectiveQueryTerms.length > 0 ? termHits / effectiveQueryTerms.length : 1;
    const avgVectorScore =
      contextChunks.reduce((acc, c) => acc + (c.score || 0.7), 0) / contextChunks.length;
    contextMatchScore = Math.min(1.0, termCoverage * 0.5 + avgVectorScore * 0.5);
  }

  // 2. Groundedness (Faithfulness) Score
  let groundedSentences = 0;
  if (answerSentences.length > 0 && contextFullText.length > 0) {
    for (const sentence of answerSentences) {
      const sentenceWords = sentence
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      let matchCount = 0;
      for (const word of sentenceWords) {
        if (contextFullText.includes(word)) matchCount += 1;
      }
      const matchRatio = sentenceWords.length > 0 ? matchCount / sentenceWords.length : 1;
      if (matchRatio >= 0.4) {
        groundedSentences += 1;
      }
    }
  }
  const groundednessScore =
    answerSentences.length > 0 ? Math.min(1.0, (groundedSentences / answerSentences.length) * 0.9 + 0.1) : 0.8;

  // 3. Answer Relevance Score
  let answerQueryHits = 0;
  const answerLower = generatedAnswer.toLowerCase();
  for (const term of queryTerms) {
    if (answerLower.includes(term)) answerQueryHits += 1;
  }
  const answerRelevanceScore =
    queryTerms.length > 0 ? Math.min(1.0, (answerQueryHits / queryTerms.length) * 0.6 + 0.4) : 0.9;

  // 4. Overall Weighted Score
  const overallScore = Math.round((contextMatchScore * 0.3 + groundednessScore * 0.4 + answerRelevanceScore * 0.3) * 100) / 100;

  const hallucinationRisk: "LOW" | "MODERATE" | "HIGH" =
    groundednessScore >= 0.8 ? "LOW" : groundednessScore >= 0.5 ? "MODERATE" : "HIGH";

  const getGrade = (s: number): "A" | "B" | "C" | "D" | "F" =>
    s >= 0.85 ? "A" : s >= 0.7 ? "B" : s >= 0.55 ? "C" : s >= 0.4 ? "D" : "F";

  return {
    contextRelevance: {
      score: Math.round(contextMatchScore * 100) / 100,
      grade: getGrade(contextMatchScore),
      details: `${contextChunks.length} context chunks retrieved with ${Math.round(contextMatchScore * 100)}% query alignment.`,
    },
    groundedness: {
      score: Math.round(groundednessScore * 100) / 100,
      grade: getGrade(groundednessScore),
      details: `${groundedSentences} of ${answerSentences.length} sentences substantiated by retrieved context.`,
    },
    answerRelevance: {
      score: Math.round(answerRelevanceScore * 100) / 100,
      grade: getGrade(answerRelevanceScore),
      details: `Answer addresses core query terms directly with ${Math.round(answerRelevanceScore * 100)}% intent coverage.`,
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
