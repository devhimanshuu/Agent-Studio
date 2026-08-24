import { Tool } from "../interfaces/Tool";
import {
  finalReportInputValidator,
  finalReportInputSchema,
  finalReportOutputSchema,
} from "../validators/finalReport";

export const finalReportTool: Tool = {
  id: "final_report",
  name: "final_report",
  displayName: "Final Report Generator",
  description:
    "Consolidates workflow results, evaluations, and external actions into a structured executive markdown report.",
  category: "TASK",
  type: "READ",
  inputSchema: finalReportInputSchema,
  outputSchema: finalReportOutputSchema,
  requiresApproval: false,
  enabled: true,

  validate(input) {
    const parsed = finalReportInputValidator.safeParse(input);
    if (parsed.success) return [];
    return parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  },

  async execute(input) {
    const parsed = finalReportInputValidator.parse(input);
    const { title, summary, stepResults, recommendation, status = "COMPLETED" } = parsed;

    const reportId = `rep_${Math.random().toString(36).slice(2, 10)}`;
    const generatedAt = new Date().toISOString();

    let formattedMarkdown = `# ${title}\n\n`;
    formattedMarkdown += `**Workflow Status**: \`${status}\`  \n`;
    formattedMarkdown += `**Generated At**: ${generatedAt}  \n`;
    formattedMarkdown += `**Report ID**: \`${reportId}\`  \n\n`;
    formattedMarkdown += `## Executive Summary\n${summary}\n\n`;

    if (recommendation) {
      formattedMarkdown += `## Recommended Next Action\n${recommendation}\n\n`;
    }

    if (stepResults && Object.keys(stepResults).length > 0) {
      formattedMarkdown += `## Execution Step Evidences\n`;
      for (const [stepKey, stepVal] of Object.entries(stepResults)) {
        formattedMarkdown += `### ${stepKey.replace(/_/g, " ").toUpperCase()}\n\`\`\`json\n${JSON.stringify(
          stepVal,
          null,
          2
        )}\n\`\`\`\n\n`;
      }
    }

    return {
      reportId,
      title,
      status,
      executiveSummary: summary,
      formattedMarkdown,
      generatedAt,
      includedStepsCount: stepResults ? Object.keys(stepResults).length : 0,
    };
  },

  async healthCheck() {
    const started = Date.now();
    try {
      await finalReportTool.execute({
        title: "Health Probe Report",
        summary: "System operational.",
      });
      return { status: "healthy", latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  },
};
