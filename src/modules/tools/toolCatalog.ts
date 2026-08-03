import { ToolCatalogItem } from "@/types/tool";
import { calculatorInputSchema } from "./validators/calculator";
import { documentSearchInputSchema } from "./validators/documentSearch";
import { recordLookupInputSchema } from "./validators/recordLookup";
import { mockTaskCreatorInputSchema } from "./validators/mockTaskCreator";

/** Registry metadata for the built-in tools. Source of truth for the
 * `tool_definitions` catalog sync (DB rows mirror this list). */
export const BUILT_IN_TOOL_CATALOG: ToolCatalogItem[] = [
  {
    name: "calculator",
    displayName: "Calculator",
    description:
      "Deterministic arithmetic — add, subtract, multiply, divide, percentage, power, and square root. Returns a structured result.",
    category: "COMPUTE",
    type: "READ",
    parameters: calculatorInputSchema,
    requiresAuth: false,
    requiresApproval: false,
    isSystem: true,
  },
  {
    name: "document_search",
    displayName: "Document Search",
    description:
      "Searches a mock knowledge base about the platform. Keyword matching with synonym expansion, ranked by relevance with a snippet.",
    category: "SEARCH",
    type: "READ",
    parameters: documentSearchInputSchema,
    requiresAuth: false,
    requiresApproval: false,
    isSystem: true,
  },
  {
    name: "record_lookup",
    displayName: "Record Lookup",
    description:
      "Structured lookup over mock records — employees, customers, orders, banks, and audit reports. Exact id match or field search, returned as JSON.",
    category: "DATA",
    type: "READ",
    parameters: recordLookupInputSchema,
    requiresAuth: false,
    requiresApproval: false,
    isSystem: true,
  },
  {
    name: "mock_task_creator",
    displayName: "Mock Task Creator",
    description:
      "Simulates creating a task — generates a taskId and returns the created task. No real persistence. WRITE action: requires human approval.",
    category: "TASK",
    type: "WRITE",
    parameters: mockTaskCreatorInputSchema,
    requiresAuth: false,
    requiresApproval: true,
    isSystem: true,
  },
];
