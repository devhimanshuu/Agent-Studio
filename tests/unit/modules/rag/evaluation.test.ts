import { describe, it, expect } from "vitest";
import { evaluateRAGTriad } from "@/modules/rag/evaluation";

describe("RAG Triad Evaluation & Grounding Observability", () => {
  it("evaluates high grounding and context relevance for well-substantiated answers", () => {
    const report = evaluateRAGTriad({
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

  it("detects hallucination when answer is not supported by context", () => {
    const report = evaluateRAGTriad({
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
