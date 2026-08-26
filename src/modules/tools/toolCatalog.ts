import { ToolCatalogItem } from "@/types/tool";
import { calculatorInputSchema } from "./validators/calculator";
import { documentSearchInputSchema } from "./validators/documentSearch";
import { recordLookupInputSchema } from "./validators/recordLookup";
import { mockTaskCreatorInputSchema } from "./validators/mockTaskCreator";
import { aiExtractionInputSchema } from "./validators/aiExtraction";
import { aiClassificationInputSchema } from "./validators/aiClassification";
import { conditionInputSchema } from "./validators/deterministicCondition";
import { finalReportInputSchema } from "./validators/finalReport";
import { codeExecutionInputSchema } from "./validators/codeExecution";

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
      "Semantic search over documents using Qdrant vector database (if configured) or PostgreSQL full-text search. Returns ranked results with relevance scores.",
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
      "Query real records from NocoDB tables or PostgreSQL execution history. Supports exact ID match and full-text search across all fields.",
    category: "DATA",
    type: "READ",
    parameters: recordLookupInputSchema,
    requiresAuth: false,
    requiresApproval: false,
    isSystem: true,
  },
  {
    name: "mock_task_creator",
    displayName: "Task Creator",
    description:
      "Create real tasks persisted to PostgreSQL. Tasks include title, description, priority, due date, and status tracking. WRITE action: requires human approval.",
    category: "TASK",
    type: "WRITE",
    parameters: mockTaskCreatorInputSchema,
    requiresAuth: false,
    requiresApproval: true,
    isSystem: true,
  },
  {
    name: "ai_extraction",
    displayName: "AI Extraction",
    description:
      "Extracts structured JSON entities and fields from unstructured text, documents, or prior step results.",
    category: "DATA",
    type: "READ",
    parameters: aiExtractionInputSchema,
    requiresAuth: false,
    requiresApproval: false,
    isSystem: true,
  },
  {
    name: "ai_classification",
    displayName: "AI Classification",
    description:
      "Classifies text, requests, or events into bounded discrete categories with confidence metrics and decision rationale.",
    category: "DATA",
    type: "READ",
    parameters: aiClassificationInputSchema,
    requiresAuth: false,
    requiresApproval: false,
    isSystem: true,
  },
  {
    name: "deterministic_condition",
    displayName: "Deterministic Condition Evaluator",
    description:
      "Evaluates deterministic business rules and conditions against workflow state, producing an auditable decision path explanation.",
    category: "COMPUTE",
    type: "READ",
    parameters: conditionInputSchema,
    requiresAuth: false,
    requiresApproval: false,
    isSystem: true,
  },
  {
    name: "final_report",
    displayName: "Final Report Generator",
    description:
      "Consolidates workflow results, evaluations, and external actions into a structured executive markdown report.",
    category: "TASK",
    type: "READ",
    parameters: finalReportInputSchema,
    requiresAuth: false,
    requiresApproval: false,
    isSystem: true,
  },
  {
    name: "code_execution",
    displayName: "Code Execution Sandbox",
    description:
      "Execute JavaScript or Python code in an isolated sandbox. Use for data processing, calculations, text manipulation, regex, JSON transformation, or any algorithmic task.",
    category: "COMPUTE",
    type: "READ",
    parameters: codeExecutionInputSchema,
    requiresAuth: false,
    requiresApproval: false,
    isSystem: true,
  },
];

