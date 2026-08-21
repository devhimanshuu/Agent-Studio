import { Tool } from "./interfaces/Tool";
import { calculatorTool } from "./calculator/calculatorTool";
import { documentSearchTool } from "./document-search/documentSearchTool";
import { recordLookupTool } from "./record-lookup/recordLookupTool";
import { mockTaskCreatorTool } from "./mock-task/mockTaskCreatorTool";
import { aiExtractionTool } from "./ai-extraction/aiExtractionTool";
import { aiClassificationTool } from "./ai-classification/aiClassificationTool";
import { deterministicConditionTool } from "./deterministic-condition/conditionTool";
import { finalReportTool } from "./final-report/finalReportTool";
import { codeExecutionTool } from "./code-execution/codeExecutionTool";

/** The built-in tools, self-registered by the registry factory. New tools
 * are added here (and to `toolCatalog.ts`) to go live. */
export const BUILT_IN_TOOLS: Tool[] = [
  calculatorTool,
  documentSearchTool,
  recordLookupTool,
  mockTaskCreatorTool,
  aiExtractionTool,
  aiClassificationTool,
  deterministicConditionTool,
  finalReportTool,
  codeExecutionTool,
];

