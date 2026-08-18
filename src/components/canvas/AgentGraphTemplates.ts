import { AgentGraphDefinition } from "@/types/graph";

export interface CanvasTemplate {
  id: string;
  name: string;
  badge: string;
  category: string;
  description: string;
  graph: AgentGraphDefinition;
}

const GRID_Y = 240;
const NODE_X = 260;

function positions(count: number): { x: number; y: number }[] {
  const ys = Array.from({ length: count }, (_, i) => {
    const offset = count === 1 ? 0 : i - (count - 1) / 2;
    return GRID_Y + offset * 150;
  });
  return ys.map((y) => ({ x: NODE_X, y }));
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "supervisor_research_code_review",
    name: "Supervisor → Researcher → Coder → Critic",
    badge: "FULL MULTI-AGENT LOOP",
    category: "ORCHESTRATION",
    description:
      "A supervisor delegates to a research agent, hands findings to a coding agent, then a critic verifies the output. Critic failures route back to the coder for another pass.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "supervisor",
          type: "supervisor",
          position: { x: NODE_X, y: GRID_Y - 150 },
          data: {
            label: "SUPERVISOR",
            prompt:
              "You are the supervisor of a software engineering crew. Analyze the incoming task and decide which specialist should act first: the researcher (to gather context) or the coder (to write code directly). Route by returning the matching edge label.",
          },
        },
        {
          id: "researcher",
          type: "agent",
          position: { x: NODE_X * 2, y: GRID_Y - 230 },
          data: {
            label: "RESEARCHER",
            prompt:
              "You are a research specialist. Investigate the task context, identify requirements, constraints, and risks. Produce a structured research brief with: 1) requirements 2) constraints 3) recommended approach. Be thorough and specific.",
          },
        },
        {
          id: "coder",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y - 150 },
          data: {
            label: "CODER",
            prompt:
              "You are a senior software engineer. Using the research brief and task context, write complete, production-quality code. Include explanations of key design decisions and note any assumptions. Output your code in a clearly delimited code block.",
          },
        },
        {
          id: "critic",
          type: "agent",
          position: { x: NODE_X * 4, y: GRID_Y - 230 },
          data: {
            label: "CRITIC / VERIFIER",
            prompt:
              "You are a rigorous code reviewer. Verify the implementation for correctness, edge cases, security issues, and completeness against the requirements. Respond with a verdict: either APPROVED (ready) or CHANGES_REQUIRED (list concrete fixes).",
          },
        },
        {
          id: "router_verdict",
          type: "router",
          position: { x: NODE_X * 5, y: GRID_Y - 150 },
          data: {
            label: "VERDICT",
            routerMode: "deterministic",
            condition: 'results.critic contains "APPROVED"',
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 6 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "supervisor" },
        { id: "e2", source: "supervisor", target: "researcher", label: "research" },
        { id: "e3", source: "researcher", target: "coder" },
        { id: "e4", source: "coder", target: "critic" },
        { id: "e5", source: "critic", target: "router_verdict" },
        { id: "e6", source: "router_verdict", target: "coder", label: "false" },
        { id: "e7", source: "router_verdict", target: "end", label: "true" },
      ],
    },
  },
  {
    id: "map_reduce_invoice_screening",
    name: "Map-Reduce Invoice Screening",
    badge: "PARALLEL FAN-OUT · LOOP",
    category: "COMPLIANCE",
    description:
      "Fans every invoice line item out to a parallel extraction worker, then reduces the results through a deterministic compliance router with a retry loop for flagged lines.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "parallel",
          type: "parallel",
          position: { x: NODE_X, y: GRID_Y },
          data: { label: "MAP · LINE ITEMS", parallelMode: "map", mapField: "input.lineItems" },
        },
        {
          id: "extractor",
          type: "tool",
          position: { x: NODE_X * 2, y: GRID_Y - 150 },
          data: {
            label: "AI EXTRACTOR",
            toolName: "ai_extraction",
            action: "extract",
            inputTemplate: { text: "{{ item }}" },
          },
        },
        {
          id: "classifier",
          type: "tool",
          position: { x: NODE_X * 3, y: GRID_Y - 150 },
          data: {
            label: "RISK CLASSIFIER",
            toolName: "ai_classification",
            action: "classify_risk",
            inputTemplate: { text: "{{ item }}" },
          },
        },
        {
          id: "router",
          type: "router",
          position: { x: NODE_X * 4, y: GRID_Y - 150 },
          data: {
            label: "RISK ROUTER",
            routerMode: "deterministic",
            condition: 'results.classifier.riskLevel == "URGENT"',
          },
        },
        {
          id: "loop",
          type: "loop",
          position: { x: NODE_X * 5, y: GRID_Y - 150 },
          data: { label: "RETRY LOOP", maxIterations: 3 },
        },
        {
          id: "recheck",
          type: "tool",
          position: { x: NODE_X * 5, y: GRID_Y - 300 },
          data: {
            label: "RECHECK",
            toolName: "deterministic_condition",
            action: "check_threshold",
            inputTemplate: { amount: "{{ item.amount }}", threshold: 1000 },
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 6 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "parallel" },
        { id: "e2", source: "parallel", target: "extractor", label: "worker" },
        { id: "e3", source: "extractor", target: "classifier" },
        { id: "e4", source: "classifier", target: "router" },
        { id: "e5", source: "router", target: "loop", label: "true" },
        { id: "e6", source: "router", target: "end", label: "false" },
        { id: "e7", source: "loop", target: "recheck", label: "body" },
        { id: "e8", source: "loop", target: "end", label: "exit" },
      ],
    },
  },
  {
    id: "hitl_disbursement",
    name: "HITL-Gated Disbursement",
    badge: "APPROVAL GATE · CONDITIONAL",
    category: "FINANCE",
    description:
      "Extracts payment details, routes small amounts straight through and large amounts through a human approval gate before the disbursement action fires.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "extractor",
          type: "tool",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "PAYMENT EXTRACTOR",
            toolName: "ai_extraction",
            action: "extract_payment",
            inputTemplate: { text: "{{ input.requestText }}" },
          },
        },
        {
          id: "router",
          type: "router",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "AMOUNT ROUTER",
            routerMode: "deterministic",
            condition: "input.amount > 500",
          },
        },
        {
          id: "approval",
          type: "approval",
          position: { x: NODE_X * 3, y: GRID_Y - 150 },
          data: {
            label: "MANAGER APPROVAL",
            approvalReason: "Disbursement exceeds the $500 auto-approval threshold and requires manager sign-off.",
          },
        },
        {
          id: "dispatch",
          type: "tool",
          position: { x: NODE_X * 4, y: GRID_Y },
          data: {
            label: "DISBURSE",
            toolName: "mock_task_creator",
            action: "disburse_funds",
            inputTemplate: { amount: "{{ input.amount }}", recipient: "{{ input.recipient }}" },
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 5 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "extractor" },
        { id: "e2", source: "extractor", target: "router" },
        { id: "e3", source: "router", target: "approval", label: "true" },
        { id: "e4", source: "router", target: "dispatch", label: "false" },
        { id: "e5", source: "approval", target: "dispatch" },
        { id: "e6", source: "dispatch", target: "end" },
      ],
    },
  },
];
