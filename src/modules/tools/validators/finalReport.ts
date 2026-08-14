import { z } from "zod";

export const finalReportInputValidator = z.object({
  title: z.string().min(1, "Report title is required"),
  summary: z.string().min(1, "Summary is required"),
  stepResults: z.record(z.unknown()).optional().default({}),
  recommendation: z.string().optional(),
  status: z.enum(["APPROVED", "REJECTED", "FLAGGED", "COMPLETED", "INFO"]).optional().default("COMPLETED"),
});

export type FinalReportInput = z.infer<typeof finalReportInputValidator>;

export const finalReportInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string", description: "Executive summary or workflow report title" },
    summary: { type: "string", description: "Consolidated workflow execution outcome" },
    stepResults: {
      type: "object",
      description: "Outputs from previous workflow steps to include in report",
    },
    recommendation: { type: "string", description: "Actionable next steps or business recommendation" },
    status: {
      type: "string",
      enum: ["APPROVED", "REJECTED", "FLAGGED", "COMPLETED", "INFO"],
      description: "Workflow overall verdict status",
    },
  },
  required: ["title", "summary"],
  additionalProperties: false,
};

export const finalReportOutputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    reportId: { type: "string" },
    title: { type: "string" },
    status: { type: "string" },
    executiveSummary: { type: "string" },
    formattedMarkdown: { type: "string" },
    generatedAt: { type: "string" },
    includedStepsCount: { type: "number" },
  },
  required: ["reportId", "title", "status", "formattedMarkdown", "generatedAt"],
};
