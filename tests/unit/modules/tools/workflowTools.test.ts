import { describe, it, expect } from "vitest";
import {
  aiExtractionTool,
  aiClassificationTool,
  deterministicConditionTool,
  finalReportTool,
} from "@/modules/tools";

describe("Bounded Workflow Step Tools", () => {
  describe("AI Extraction Tool", () => {
    it("extracts structured fields from unstructured invoice text", async () => {
      const text = "Invoice ID: INV-90412, Customer Name: Wayne Enterprises, Amount: $3500.00, Email: bruce@wayne.com";
      const result = (await aiExtractionTool.execute({
        text,
        fieldsToExtract: ["Invoice ID", "Customer Name", "Amount", "Email"],
      })) as { extractedData: Record<string, unknown>; confidenceScore: number; extractedFieldCount: number };

      expect(result.extractedData["Invoice ID"]).toBe("INV-90412");
      expect(result.extractedData["Customer Name"]).toBe("Wayne Enterprises");
      expect(result.extractedData["Amount"]).toBe(3500);
      expect(result.extractedData["Email"]).toBe("bruce@wayne.com");
      expect(result.extractedFieldCount).toBe(4);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.75);
    });

    it("validates required parameters", () => {
      expect(aiExtractionTool.validate({ text: "", fieldsToExtract: [] })).toHaveLength(2);
    });

    it("passes health check", async () => {
      await expect(aiExtractionTool.healthCheck()).resolves.toMatchObject({ status: "healthy" });
    });
  });

  describe("AI Classification Tool", () => {
    it("classifies customer intent and provides reasoning", async () => {
      const input = "I need an urgent refund for double charge on invoice #901";
      const categories = ["REFUND", "TECHNICAL_SUPPORT", "GENERAL_INQUIRY"];
      const result = (await aiClassificationTool.execute({
        input,
        categories,
      })) as { assignedCategory: string; confidence: number; reasoning: string };

      expect(result.assignedCategory).toBe("REFUND");
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toContain("Classified as 'REFUND'");
    });

    it("passes health check", async () => {
      await expect(aiClassificationTool.healthCheck()).resolves.toMatchObject({ status: "healthy" });
    });
  });

  describe("Deterministic Condition Evaluator", () => {
    it("evaluates greater_than condition and produces explicit decision path explanation", async () => {
      const result = (await deterministicConditionTool.execute({
        field: "refundAmount",
        operator: "greater_than",
        actualValue: 2500,
        threshold: 1000,
      })) as { conditionMet: boolean; decisionExplanation: string; selectedBranch: string };

      expect(result.conditionMet).toBe(true);
      expect(result.selectedBranch).toBe("TRUE_BRANCH");
      expect(result.decisionExplanation).toContain("[DECISION PATH: TRUE_BRANCH]");
      expect(result.decisionExplanation).toContain("value 2500 exceeds threshold 1000");
    });

    it("evaluates equals condition when condition is false", async () => {
      const result = (await deterministicConditionTool.execute({
        field: "status",
        operator: "equals",
        actualValue: "REJECTED",
        threshold: "APPROVED",
      })) as { conditionMet: boolean; decisionExplanation: string; selectedBranch: string };

      expect(result.conditionMet).toBe(false);
      expect(result.selectedBranch).toBe("FALSE_BRANCH");
      expect(result.decisionExplanation).toContain("[DECISION PATH: FALSE_BRANCH]");
    });

    it("passes health check", async () => {
      await expect(deterministicConditionTool.healthCheck()).resolves.toMatchObject({ status: "healthy" });
    });
  });

  describe("Final Report Tool", () => {
    it("generates markdown report aggregating previous step results", async () => {
      const result = (await finalReportTool.execute({
        title: "Refund Approval Report",
        summary: "Customer refund of $3500 approved after deterministic risk screening.",
        stepResults: {
          extraction: { amount: 3500, customer: "Wayne Enterprises" },
          condition: { conditionMet: true, branch: "TRUE_BRANCH" },
        },
        recommendation: "Issue credit memo directly to customer account.",
        status: "APPROVED",
      })) as { reportId: string; status: string; formattedMarkdown: string; includedStepsCount: number };

      expect(result.status).toBe("APPROVED");
      expect(result.formattedMarkdown).toContain("# Refund Approval Report");
      expect(result.formattedMarkdown).toContain("## Executive Summary");
      expect(result.formattedMarkdown).toContain("## Execution Step Evidences");
      expect(result.includedStepsCount).toBe(2);
    });

    it("passes health check", async () => {
      await expect(finalReportTool.healthCheck()).resolves.toMatchObject({ status: "healthy" });
    });
  });
});
