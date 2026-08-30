import { describe, it, expect, vi } from "vitest";
import { evaluateRAGTriad } from "@/modules/rag/evaluation";

// evaluateRAGTriad now delegates each leg to the real LLM-as-a-Judge (see llmJudge.ts).
// Mock the judge here so this stays a fast, deterministic unit test of the report
// wiring/grading logic rather than a live network test against an LLM provider.
vi.mock("@/modules/evals/llmJudge", () => ({
  evaluateMetricWithJudge: vi.fn(async (metric: string, _input: unknown, output: string) => {
    const isHallucinated = /paris|eiffel|louvre/i.test(output);
    const score = isHallucinated ? 0.1 : 0.9;
    return { metric, score, passed: score >= 0.7, reasoning: `mock judge score for ${metric}` };
  }),
}));

describe("RAG Triad Evaluation & Grounding Observability", () => {
  it("evaluates high grounding and context relevance for well-substantiated answers", async () => {
    const report = await evaluateRAGTriad({
      query: "How does pgvector perform cosine similarity search in PostgreSQL?",
      contextChunks: [
        {
          content:
            "pgvector is an open-source vector similarity extension for PostgreSQL. It enables cosine distance (<=>) queries using HNSW indexing.",
          score: 0.94,
          title: "pgvector Guide",
        },
      ],
      generatedAnswer:
        "pgvector performs cosine similarity search in PostgreSQL using the <=> cosine distance operator and HNSW indexing for high speed.",
    });

    expect(report.contextRelevance.score).toBeGreaterThanOrEqual(0.7);
    expect(report.groundedness.score).toBeGreaterThanOrEqual(0.7);
    expect(report.answerRelevance.score).toBeGreaterThanOrEqual(0.7);
    expect(report.hallucinationRisk).toBe("LOW");
    expect(report.overallGrade).toMatch(/A|B/);
  });

  it("detects hallucination when answer is not supported by context", async () => {
    const report = await evaluateRAGTriad({
      query: "What is the capital of France?",
      contextChunks: [
        {
          content: "PostgreSQL databases store relational tables and vector chunks.",
          score: 0.2,
          title: "DB Guide",
        },
      ],
      generatedAnswer:
        "The capital of France is Paris, famous for the Eiffel Tower and the Louvre museum.",
    });

    expect(report.groundedness.score).toBeLessThanOrEqual(0.8);
  });
});
