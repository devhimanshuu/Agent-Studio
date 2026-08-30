import { ToolRegistry } from "./registry/ToolRegistry";

export { ToolRegistry } from "./registry/ToolRegistry";
export type { ToolRegistryOptions } from "./registry/ToolRegistry";
export type { Tool, ToolHealth } from "./interfaces/Tool";
export {
  ToolNotFoundError,
  ToolDisabledError,
  ToolValidationError,
  ToolTimeoutError,
  ToolExecutionFailureError,
} from "./errors";
export { BUILT_IN_TOOL_CATALOG } from "./toolCatalog";
export { TOOL_CATEGORIES, getToolCategory, isToolCategory, toolCategoryLabel } from "./categories";
export type { ToolCategoryDef } from "./categories";
export { calculatorTool } from "./calculator/calculatorTool";
export { documentSearchTool } from "./document-search/documentSearchTool";
export { recordLookupTool } from "./record-lookup/recordLookupTool";
export { mockTaskCreatorTool } from "./mock-task/mockTaskCreatorTool";
export { aiExtractionTool } from "./ai-extraction/aiExtractionTool";
export { aiClassificationTool } from "./ai-classification/aiClassificationTool";
export { deterministicConditionTool } from "./deterministic-condition/conditionTool";
export { finalReportTool } from "./final-report/finalReportTool";

/** Production registry pre-loaded with all built-in tools. */
export function createToolRegistry(): ToolRegistry {
  return ToolRegistry.withBuiltInTools();
}

