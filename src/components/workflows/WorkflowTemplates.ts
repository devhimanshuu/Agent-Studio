export interface WorkflowTemplate {
  id: string;
  name: string;
  purpose: string;
  category: "FINANCE" | "COMPLIANCE" | "OPERATIONS" | "SUPPORT";
  badge: string;
  stepsSummary: string[];
  instructions: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  examples: Array<{ input: Record<string, unknown>; output: Record<string, unknown> }>;
  allowedTools: string[];
  actionsRequiringApproval: string[];
  maxExecutionSteps: number;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "customer_refund_automation",
    name: "Customer Refund Automation",
    purpose: "Bounded multi-step workflow: retrieves customer policy, extracts refund parameters, evaluates deterministic rules, requests human approval for disbursements, and generates a final audit report.",
    category: "FINANCE",
    badge: "HITL GATED · DECISION EXPLAINER",
    stepsSummary: ["Structured Input", "Doc Retrieval", "AI Extraction", "Deterministic Condition", "Human Approval", "Mock Action", "Final Report"],
    instructions: "1. Search for customer policy. 2. Extract refund amount and invoice number. 3. Evaluate if refund amount > $500. 4. If high value, request manager approval. 5. If approved, dispatch mock refund task. 6. Generate final report.",
    inputSchema: {
      type: "object",
      properties: {
        customerName: { type: "string", description: "Name of customer requesting refund" },
        requestText: { type: "string", description: "Customer inquiry or support ticket text with amount and reason" },
      },
      required: ["customerName", "requestText"],
    },
    outputSchema: {
      type: "object",
      properties: {
        report: { type: "object" },
        status: { type: "string" },
      },
    },
    examples: [
      {
        input: {
          customerName: "Acme Logistics",
          requestText: "Customer requested a $750.00 refund due to damaged shipment on invoice #INV-8891",
        },
        output: { status: "COMPLETED" },
      },
    ],
    allowedTools: [
      "document_search",
      "ai_extraction",
      "deterministic_condition",
      "mock_task_creator",
      "final_report",
    ],
    actionsRequiringApproval: ["create_task"],
    maxExecutionSteps: 10,
  },
  {
    id: "invoice_risk_screening",
    name: "Invoice Compliance & Risk Screening",
    purpose: "Extracts vendor invoice line items, classifies transaction risk category, applies deterministic threshold tests, and synthesizes an executive compliance report.",
    category: "COMPLIANCE",
    badge: "AUTOMATED AUDIT · SAFE RETRY",
    stepsSummary: ["Structured Input", "AI Extraction", "AI Classification", "Deterministic Condition", "Final Report"],
    instructions: "1. Extract invoice amount, vendor name, and tax ID from invoice text. 2. Classify risk level (STANDARD, SUSPICIOUS, URGENT). 3. Evaluate if amount > $10,000 or risk is SUSPICIOUS. 4. Compile executive compliance report.",
    inputSchema: {
      type: "object",
      properties: {
        vendorName: { type: "string" },
        invoiceText: { type: "string" },
      },
      required: ["vendorName", "invoiceText"],
    },
    outputSchema: {
      type: "object",
      properties: {
        complianceStatus: { type: "string" },
        executiveReport: { type: "object" },
      },
    },
    examples: [
      {
        input: {
          vendorName: "Globex Corp",
          invoiceText: "Invoice #GLX-4001: Amount: $14,250.00. Expedited consulting retainer.",
        },
        output: { complianceStatus: "FLAGGED_FOR_AUDIT" },
      },
    ],
    allowedTools: [
      "ai_extraction",
      "ai_classification",
      "deterministic_condition",
      "final_report",
    ],
    actionsRequiringApproval: [],
    maxExecutionSteps: 8,
  },
  {
    id: "support_ticket_triage",
    name: "Support Ticket Intent Triage & Escalation",
    purpose: "Classifies incoming customer support tickets, searches relevant knowledge base solutions, creates high-priority escalations when necessary, and generates resolution summaries.",
    category: "SUPPORT",
    badge: "CLASSIFICATION · KNOWLEDGE SEARCH",
    stepsSummary: ["Structured Input", "AI Classification", "Doc Retrieval", "Deterministic Condition", "Mock Action", "Final Report"],
    instructions: "1. Classify ticket intent into categories (BILLING, TECHNICAL_SUPPORT, SECURITY_INCIDENT). 2. Retrieve knowledge base articles for the issue. 3. If category is SECURITY_INCIDENT, escalate task with HIGH priority. 4. Output structured response report.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "string" },
        customerEmail: { type: "string" },
        ticketBody: { type: "string" },
      },
      required: ["ticketId", "customerEmail", "ticketBody"],
    },
    outputSchema: {
      type: "object",
      properties: {
        assignedQueue: { type: "string" },
        resolutionSummary: { type: "string" },
      },
    },
    examples: [
      {
        input: {
          ticketId: "TCK-9901",
          customerEmail: "user@example.com",
          ticketBody: "I cannot access my account and received an unauthorized password reset email.",
        },
        output: { assignedQueue: "SECURITY_ESCALATION" },
      },
    ],
    allowedTools: [
      "ai_classification",
      "document_search",
      "deterministic_condition",
      "mock_task_creator",
      "final_report",
    ],
    actionsRequiringApproval: ["create_task"],
    maxExecutionSteps: 10,
  },
];
