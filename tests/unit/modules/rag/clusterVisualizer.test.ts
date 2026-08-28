import { describe, it, expect } from "vitest";
import { projectVectorsTo2D } from "@/modules/rag/clusterVisualizer";
import { embedLocally } from "@/modules/rag/embeddingService";

describe("2D Vector PCA Cluster Visualizer", () => {
  it("projects 1536-dimensional embeddings onto normalized 2D coordinates", () => {
    const v1 = embedLocally("PostgreSQL database pgvector storage");
    const v2 = embedLocally("PostgreSQL database indexing with HNSW");
    const v3 = embedLocally("Banana strawberry fruit recipe");

    const items = [
      {
        id: "1",
        documentId: "d1",
        title: "pgvector Storage",
        collection: "database",
        content: "PostgreSQL database pgvector storage",
        embedding: v1.vector,
      },
      {
        id: "2",
        documentId: "d1",
        title: "HNSW Indexing",
        collection: "database",
        content: "PostgreSQL database indexing with HNSW",
        embedding: v2.vector,
      },
      {
        id: "3",
        documentId: "d2",
        title: "Fruit Recipe",
        collection: "cooking",
        content: "Banana strawberry fruit recipe",
        embedding: v3.vector,
      },
    ];

    const result = projectVectorsTo2D(items, {
      vector: v1.vector,
      text: "pgvector query",
    });

    expect(result.points).toHaveLength(3);
    expect(result.collections).toHaveLength(2);
    expect(result.queryPoint).toBeDefined();

    for (const pt of result.points) {
      expect(pt.x).toBeGreaterThanOrEqual(-1.0);
      expect(pt.x).toBeLessThanOrEqual(1.0);
      expect(pt.y).toBeGreaterThanOrEqual(-1.0);
      expect(pt.y).toBeLessThanOrEqual(1.0);
    }
  });

  it("handles empty items array gracefully", () => {
    const result = projectVectorsTo2D([]);
    expect(result.points).toHaveLength(0);
    expect(result.stats.totalPoints).toBe(0);
  });
});
