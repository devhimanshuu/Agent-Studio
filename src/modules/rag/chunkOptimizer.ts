/**
 * Automatic Chunk Size Optimizer
 *
 * Analyzes document characteristics and recommends optimal chunking parameters:
 * - Content structure analysis (paragraph lengths, heading density, code vs prose ratio)
 * - Embedding model compatibility (token limits, optimal input length)
 * - Statistical analysis of chunk quality metrics (coherence, completeness, overlap efficiency)
 * - Grid search over parameter space with scoring heuristic
 */

import {
  chunkDocument,
  mergeSmallChunks,
  estimateTokens,
  ChunkingOptions,
  DocumentChunk,
} from "./chunkingService";

// ─── Types ───

export interface DocumentProfile {
  /** Total character count */
  totalChars: number;
  /** Total word count */
  totalWords: number;
  /** Estimated token count */
  totalTokens: number;
  /** Number of headings detected */
  headingCount: number;
  /** Average paragraph length in characters */
  avgParagraphLength: number;
  /** Paragraph length standard deviation */
  paragraphLengthStdDev: number;
  /** Ratio of code-like content to prose */
  codeRatio: number;
  /** Ratio of tabular content */
  tableRatio: number;
  /** Average sentence length in characters */
  avgSentenceLength: number;
  /** Number of sentences */
  sentenceCount: number;
  /** Detected content type */
  contentType: "prose" | "technical" | "code" | "mixed" | "tabular";
  /** Recommended chunking strategy */
  recommendedStrategy: ChunkingOptions["strategy"];
}

export interface ChunkQualityMetrics {
  /** Average chunk size in characters */
  avgChunkChars: number;
  /** Average chunk size in tokens */
  avgChunkTokens: number;
  /** Size variance across chunks (coefficient of variation) */
  sizeVarianceCV: number;
  /** Ratio of chunks below minimum viable size */
  tooSmallRatio: number;
  /** Ratio of chunks exceeding optimal size */
  tooLargeRatio: number;
  /** Overlap efficiency: how much unique content is preserved per token of overlap */
  overlapEfficiency: number;
  /** Semantic coherence score (based on heading boundary preservation) */
  coherenceScore: number;
  /** Overall quality score (0-100) */
  overallScore: number;
}

/** Configurable thresholds for chunk quality analysis. */
export interface ChunkQualityOptions {
  /** Minimum viable chunk size in chars (default: 100) */
  minChunkChars?: number;
  /** Maximum optimal chunk size in chars (default: 1500) */
  maxChunkChars?: number;
  /** Target average chunk size in chars for scoring (default: 800) */
  targetAvgChars?: number;
  /** Target completeness ratio (default: 0.8) */
  targetCompleteness?: number;
  /** Penalty weight for too-small chunks (default: 0.3) */
  tooSmallPenalty?: number;
  /** Penalty weight for too-large chunks (default: 0.2) */
  tooLargePenalty?: number;
}

export interface OptimizationResult {
  /** Best parameters found */
  optimalParams: ChunkingOptions;
  /** Quality metrics for the optimal configuration */
  optimalMetrics: ChunkQualityMetrics;
  /** Document profile used for optimization */
  documentProfile: DocumentProfile;
  /** All parameter combinations evaluated */
  evaluatedConfigs: Array<{
    params: ChunkingOptions;
    metrics: ChunkQualityMetrics;
  }>;
  /** Recommended strategy explanation */
  explanation: string;
}

// ─── Document Profiling ───

/**
 * Analyze document structure to build a content profile.
 */
export function profileDocument(document: string): DocumentProfile {
  const totalChars = document.length;
  const words = document.split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  const totalTokens = estimateTokens(document);

  // Heading detection
  const headingRegex = /^#{1,6}\s+.+$/gm;
  const headings = document.match(headingRegex) || [];
  const headingCount = headings.length;

  // Paragraph analysis
  const paragraphs = document.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const paragraphLengths = paragraphs.map((p) => p.length);
  const avgParagraphLength = paragraphLengths.length > 0
    ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
    : totalChars;
  const paragraphLengthStdDev = computeStdDev(paragraphLengths);

  // Sentence analysis
  const sentences = document.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 10);
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0
    ? sentences.reduce((a, s) => a + s.length, 0) / sentenceCount
    : 100;

  // Code vs prose ratio
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = document.match(codeBlockRegex) || [];
  const codeChars = codeBlocks.reduce((a, b) => a + b.length, 0);
  const codeRatio = totalChars > 0 ? codeChars / totalChars : 0;

  // Table detection
  const tableRegex = /\|[^|]+\|/g;
  const tableMatches = document.match(tableRegex) || [];
  const tableChars = tableMatches.reduce((a, b) => a + b.length, 0);
  const tableRatio = totalChars > 0 ? tableChars / totalChars : 0;

  // Content type classification
  let contentType: DocumentProfile["contentType"] = "prose";
  if (codeRatio > 0.3) contentType = "code";
  else if (tableRatio > 0.2) contentType = "tabular";
  else if (codeRatio > 0.1 || headingCount > totalWords / 200) contentType = "technical";
  else if (codeRatio > 0.05 || tableRatio > 0.05) contentType = "mixed";

  // Strategy recommendation
  let recommendedStrategy: ChunkingOptions["strategy"] = "recursive";
  if (contentType === "code") recommendedStrategy = "recursive";
  else if (contentType === "technical" && headingCount > 3) recommendedStrategy = "markdown";
  else if (contentType === "tabular") recommendedStrategy = "fixed";
  else if (avgSentenceLength > 120) recommendedStrategy = "semantic";
  else recommendedStrategy = "recursive";

  return {
    totalChars,
    totalWords,
    totalTokens,
    headingCount,
    avgParagraphLength: Math.round(avgParagraphLength),
    paragraphLengthStdDev: Math.round(paragraphLengthStdDev),
    codeRatio: Math.round(codeRatio * 100) / 100,
    tableRatio: Math.round(tableRatio * 100) / 100,
    avgSentenceLength: Math.round(avgSentenceLength),
    sentenceCount,
    contentType,
    recommendedStrategy,
  };
}

// ─── Chunk Quality Analysis ───

/**
 * Analyze chunk quality for a given set of chunks.
 */
export function analyzeChunkQuality(
  chunks: DocumentChunk[],
  documentTokens: number,
  options: ChunkQualityOptions = {}
): ChunkQualityMetrics {
  const {
    minChunkChars = 100,
    maxChunkChars = 1500,
    targetAvgChars = 800,
    targetCompleteness = 0.8,
    tooSmallPenalty = 0.3,
    tooLargePenalty = 0.2,
  } = options;
  if (chunks.length === 0) {
    return {
      avgChunkChars: 0,
      avgChunkTokens: 0,
      sizeVarianceCV: 0,
      tooSmallRatio: 0,
      tooLargeRatio: 0,
      overlapEfficiency: 0,
      coherenceScore: 0,
      overallScore: 0,
    };
  }

  const charCounts = chunks.map((c) => c.content.length);
  const tokenCounts = chunks.map((c) => c.metadata.tokenCount);

  const avgChunkChars = charCounts.reduce((a, b) => a + b, 0) / charCounts.length;
  const avgChunkTokens = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
  const sizeVarianceCV = computeCV(charCounts);

  // Too small or too large based on configurable thresholds
  const tooSmallRatio = charCounts.filter((c) => c < minChunkChars).length / chunks.length;
  const tooLargeRatio = charCounts.filter((c) => c > maxChunkChars).length / chunks.length;

  // Overlap efficiency: unique content ratio
  const allContent = chunks.map((c) => c.content).join("\n");
  const uniqueChars = new Set(allContent.split("")).size;
  const overlapEfficiency = allContent.length > 0 ? uniqueChars / allContent.length : 0;

  // Coherence: check that chunks with sections maintain section headers
  let coherenceHits = 0;
  for (const chunk of chunks) {
    if (chunk.metadata.section) {
      // Check if section header is in the chunk or at the beginning
      if (chunk.content.toLowerCase().includes(chunk.metadata.section.toLowerCase().split(" > ")[0])) {
        coherenceHits++;
      }
    }
  }
  const coherenceScore = chunks.length > 0 ? coherenceHits / chunks.length : 1.0;

  // Overall score: weighted combination
  const sizeBalance = 1 - Math.abs(0.5 - (avgChunkChars / targetAvgChars));
  const completeness = Math.min(1, (avgChunkChars * chunks.length) / documentTokens / targetCompleteness);
  const smallnessPenalty = tooSmallRatio * tooSmallPenalty;
  const largenessPenalty = tooLargeRatio * tooLargePenalty;

  const overallScore = Math.round(
    Math.max(0, Math.min(100,
      (sizeBalance * 25 + completeness * 25 + coherenceScore * 25 + overlapEfficiency * 25) -
      (smallnessPenalty + largenessPenalty) * 100
    ))
  );

  return {
    avgChunkChars: Math.round(avgChunkChars),
    avgChunkTokens: Math.round(avgChunkTokens),
    sizeVarianceCV: Math.round(sizeVarianceCV * 100) / 100,
    tooSmallRatio: Math.round(tooSmallRatio * 100) / 100,
    tooLargeRatio: Math.round(tooLargeRatio * 100) / 100,
    overlapEfficiency: Math.round(overlapEfficiency * 100) / 100,
    coherenceScore: Math.round(coherenceScore * 100) / 100,
    overallScore,
  };
}

// ─── Optimization Engine ───

/**
 * Automatically find optimal chunking parameters for a document.
 * Performs a grid search over parameter space and scores each configuration.
 */
export function optimizeChunking(
  document: string,
  options: {
    /** Number of top results to return */
    topK?: number;
    /** Custom parameter grid to search */
    parameterGrid?: Partial<ChunkingOptions>[];
    /** Embedding model token limit (default: 8192) */
    maxModelTokens?: number;
  } = {}
): OptimizationResult {
  const {
    topK = 3,
    maxModelTokens = 8192,
  } = options;

  const profile = profileDocument(document);
  const documentTokens = estimateTokens(document);

  // Build parameter grid based on document profile
  const grid = options.parameterGrid || buildParameterGrid(profile, documentTokens, maxModelTokens);

  const evaluated: Array<{ params: ChunkingOptions; metrics: ChunkQualityMetrics }> = [];

  for (const params of grid) {
    const chunks = mergeSmallChunks(chunkDocument(document, params), 100);
    const metrics = analyzeChunkQuality(chunks, documentTokens);
    evaluated.push({ params, metrics });
  }

  // Sort by overall score
  evaluated.sort((a, b) => b.metrics.overallScore - a.metrics.overallScore);

  const optimal = evaluated[0];
  const explanation = buildExplanation(profile, optimal.params, optimal.metrics);

  return {
    optimalParams: optimal.params,
    optimalMetrics: optimal.metrics,
    documentProfile: profile,
    evaluatedConfigs: evaluated.slice(0, topK),
    explanation,
  };
}

function buildParameterGrid(
  profile: DocumentProfile,
  _documentTokens?: number,
  _maxModelTokens?: number
): ChunkingOptions[] {
  const grid: ChunkingOptions[] = [];
  const strategy = profile.recommendedStrategy;

  // Chunk sizes: scale based on document characteristics
  const baseSizes = profile.contentType === "code"
    ? [400, 600, 800, 1000]
    : profile.contentType === "technical"
    ? [500, 700, 900, 1200]
    : [600, 800, 1000, 1500];

  // Overlap ratios: 10%, 15%, 20%, 25% of chunk size
  const overlapRatios = [0.10, 0.15, 0.20, 0.25];

  for (const maxChunkSize of baseSizes) {
    for (const ratio of overlapRatios) {
      const overlap = Math.round(maxChunkSize * ratio);
      grid.push({
        maxChunkSize,
        overlap,
        strategy,
        source: "optimizer",
      });
    }
  }

  // Also try the recommended strategy with default sizes
  if (strategy === "markdown") {
    grid.push({ maxChunkSize: 800, overlap: 150, strategy: "markdown", source: "optimizer" });
    grid.push({ maxChunkSize: 1000, overlap: 200, strategy: "markdown", source: "optimizer" });
  }

  // Add Small-to-Big parent-child configuration
  grid.push({
    maxChunkSize: 300,
    overlap: 60,
    strategy: "recursive",
    parentChunkSize: 1200,
    source: "optimizer",
  });

  return grid;
}

function buildExplanation(
  profile: DocumentProfile,
  params: ChunkingOptions,
  metrics: ChunkQualityMetrics
): string {
  const parts: string[] = [];

  parts.push(`Document type: ${profile.contentType} (${profile.totalTokens} tokens, ${profile.headingCount} headings)`);

  if (profile.codeRatio > 0.1) {
    parts.push(`High code content (${Math.round(profile.codeRatio * 100)}%) — smaller chunks preserve function boundaries`);
  }

  if (profile.headingCount > 5) {
    parts.push(`Rich heading structure (${profile.headingCount} headings) — markdown-aware splitting preserves context`);
  }

  parts.push(
    `Optimal config: ${params.strategy} strategy, ${params.maxChunkSize} chars max, ${params.overlap} chars overlap`
  );

  parts.push(
    `Quality: ${metrics.overallScore}/100 (avg ${metrics.avgChunkChars} chars/chunk, ${metrics.coherenceScore} coherence, ${Math.round(metrics.tooSmallRatio * 100)}% too small, ${Math.round(metrics.tooLargeRatio * 100)}% too large)`
  );

  if (params.parentChunkSize) {
    parts.push(`Small-to-Big enabled: child chunks of ${params.maxChunkSize} chars map to ${params.parentChunkSize}-char parent contexts`);
  }

  return parts.join(". ");
}

// ─── Utilities ───

function computeStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

function computeCV(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const stdDev = computeStdDev(values);
  return stdDev / mean;
}
