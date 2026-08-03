import { Tool } from "./interfaces/Tool";
import { calculatorTool } from "./calculator/calculatorTool";
import { documentSearchTool } from "./document-search/documentSearchTool";
import { recordLookupTool } from "./record-lookup/recordLookupTool";
import { mockTaskCreatorTool } from "./mock-task/mockTaskCreatorTool";

/** The four built-in tools, self-registered by the registry factory. New tools
 * are added here (and to `toolCatalog.ts`) to go live. */
export const BUILT_IN_TOOLS: Tool[] = [
  calculatorTool,
  documentSearchTool,
  recordLookupTool,
  mockTaskCreatorTool,
];
