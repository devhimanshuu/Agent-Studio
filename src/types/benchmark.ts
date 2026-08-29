/**
 * Agent Evaluation & Benchmarking Suite Types
 */

export type BenchmarkCategory =
  | "TOOL_CALLING"
  | "MULTI_AGENT_MESH"
  | "RAG_GROUNDING"
  | "SAFETY_GUARDRAILS"
  | "PERFORMANCE_COST"
  | "GENERAL_REASONING";

export type BenchmarkDifficulty = "EASY" | "MEDIUM" | "HARD" | "ADVERSARIAL";

export type BenchmarkGrade = "A+" | "A" | "B" | "C" | "D" | "F";

export interface BenchmarkAssertion {
  type:
    | "CONTAINS_STRING"
    | "REGEX_MATCH"
    | "SEMANTIC_SIMILARITY"
    | "TOOL_CALLED"
    | "TOOL_NOT_CALLED"
    | "MAX_DURATION_MS"
    | "MAX_TOKENS"
    | "JSON_SCHEMA_VALID";
  target: string | number | Record<string, unknown>;
  weight?: number; // 0.1 to 1.0
  description?: string;
}

export interface BenchmarkTestCase {
  id: string;
  name: string;
  description: string;
  input: Record<string, unknown>;
  expectedOutputSummary?: string;
  assertions: BenchmarkAssertion[];
  category: BenchmarkCategory;
  difficulty: BenchmarkDifficulty;
  timeoutMs?: number;
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  badge: string;
  category: BenchmarkCategory;
  description: string;
  testCases: BenchmarkTestCase[];
  recommendedModel?: string;
}

export interface AssertionEvaluationResult {
  assertion: BenchmarkAssertion;
  passed: boolean;
  score: number; // 0.0 to 1.0
  actualValue?: unknown;
  message: string;
}

export interface TestCaseResult {
  testCaseId: string;
  name: string;
  passed: boolean;
  score: number; // 0.0 to 1.0
  durationMs: number;
  tokensUsed: number;
  tokensPerSec: number;
  outputSummary: string;
  assertions: AssertionEvaluationResult[];
  error?: string;
}

export interface BenchmarkRadarMetrics {
  accuracyScore: number; // 0 - 100
  toolPrecisionScore: number; // 0 - 100
  latencyScore: number; // 0 - 100
  costEfficiencyScore: number; // 0 - 100
  safetyComplianceScore: number; // 0 - 100
  multiAgentCohesionScore: number; // 0 - 100
}

export interface BenchmarkScorecard {
  id: string;
  suiteId: string;
  suiteName: string;
  category: BenchmarkCategory;
  skillId?: string;
  skillName: string;
  modelEvaluated: string;
  executedAt: string;
  durationMs: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number; // 0 - 100%
  overallScore: number; // 0 - 100
  grade: BenchmarkGrade;
  radar: BenchmarkRadarMetrics;
  testResults: TestCaseResult[];
  recommendations: string[];
}

export interface ModelBenchmarkComparisonItem {
  modelName: string;
  provider: string;
  overallScore: number;
  passRate: number;
  avgLatencyMs: number;
  costPer1kRuns: number;
  grade: BenchmarkGrade;
  strengths: string[];
  weaknesses: string[];
}
