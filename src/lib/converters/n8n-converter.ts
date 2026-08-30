import { AgentGraphDefinition, GraphEdgeDefinition, GraphNodeDefinition, GraphNodeType } from "@/types/graph";
import { WorkflowTemplate } from "@/components/workflows/WorkflowTemplates";

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, unknown>;
  typeVersion?: number;
  webhookId?: string;
  credentials?: Record<string, unknown>;
  disabled?: boolean;
}

export interface N8nConnectionTarget {
  node: string;
  type: string;
  index: number;
}

export interface N8nWorkflowData {
  id?: string | number;
  name?: string;
  description?: string;
  nodes: N8nNode[];
  connections?: Record<string, Record<string, N8nConnectionTarget[][]>>;
  settings?: Record<string, unknown>;
  staticData?: unknown;
  tags?: Array<{ id?: string; name: string } | string>;
}

/**
 * Robust JSON parser for n8n workflow files.
 */
export function parseN8nWorkflowJson(jsonText: string): N8nWorkflowData | null {
  if (!jsonText || typeof jsonText !== "string") return null;
  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === "object" ? (parsed as N8nWorkflowData) : null;
  } catch {
    return null;
  }
}

/**
 * Maps an n8n node type string to Agent Studio GraphNodeType.
 */
function mapN8nNodeType(n8nType: string): GraphNodeType {
  const t = (n8nType || "").toLowerCase();

  // Triggers & Entry points
  if (
    t.includes("trigger") ||
    t.includes("webhook") ||
    t.includes("cron") ||
    t.includes("schedule") ||
    t.includes("emailread") ||
    t.includes("start")
  ) {
    return "start";
  }

  // LLM & LangChain Agent nodes
  if (
    t.includes("langchain") ||
    t.includes("agent") ||
    t.includes("chainllm") ||
    t.includes("chainsummarization") ||
    t.includes("lmchat") ||
    t.includes("openai") ||
    t.includes("anthropic") ||
    t.includes("gemini")
  ) {
    return "agent";
  }

  // Routing & Conditionals
  if (t.includes(".if") || t.includes(".switch") || t.includes(".filter") || t.includes(".router")) {
    return "router";
  }

  // HTTP & API calls
  if (t.includes("httprequest") || t.includes("graphql") || t.includes("oauth")) {
    return "http";
  }

  // Data transforms & code
  if (
    t.includes(".code") ||
    t.includes(".function") ||
    t.includes(".set") ||
    t.includes(".itemlists") ||
    t.includes("editfields")
  ) {
    return "transform";
  }

  // Notes & Annotations
  if (t.includes("stickynote") || t.includes("note")) {
    return "sticky_note";
  }

  // Human approval / Wait gates
  if (t.includes("hitl") || t.includes("approval") || t.includes("human")) {
    return "approval";
  }

  // Delays
  if (t.includes(".wait") || t.includes(".delay")) {
    return "delay";
  }

  // Aggregation & Merges
  if (t.includes(".merge") || t.includes(".aggregate") || t.includes(".combine")) {
    return "aggregate";
  }

  // Default to tool for other services (Slack, Google Sheets, Postgres, Supabase, Github, etc.)
  return "tool";
}

/**
 * Extracts a system prompt or role description from an n8n node.
 */
function extractPromptOrDescription(node: N8nNode): { prompt?: string; description?: string; allowedTools?: string[] } {
  const p = node.parameters || {};
  const messages = p.messages as Record<string, unknown> | undefined;
  const messageValues = messages?.messageValues as Array<Record<string, unknown>> | undefined;
  const options = p.options as Record<string, unknown> | undefined;

  // Check common prompt locations
  const prompt =
    p.prompt ||
    p.systemMessage ||
    p.text ||
    p.jsCode ||
    messageValues?.[0]?.message ||
    options?.systemMessage;

  const desc =
    p.details ||
    p.notes ||
    `n8n node: ${node.name} (${node.type.replace(/^n8n-nodes-base\./, "").replace(/^@n8n\/n8n-nodes-langchain\./, "")})`;

  const tools: string[] = [];
  if (node.type.includes("agent") || node.type.includes("chain")) {
    tools.push("document_search", "web_search", "code_evaluator");
  }

  return {
    prompt: typeof prompt === "string" ? prompt : undefined,
    description: typeof desc === "string" ? desc : undefined,
    allowedTools: tools.length > 0 ? tools : undefined,
  };
}

/**
 * Converts an n8n workflow JSON into an Agent Studio AgentGraphDefinition.
 */
export function convertN8nToAgentGraph(n8nWorkflow: N8nWorkflowData): AgentGraphDefinition {
  const rawNodes = n8nWorkflow.nodes || [];
  const rawConnections = n8nWorkflow.connections || {};

  if (rawNodes.length === 0) {
    return {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 60, y: 240 }, data: { label: "START" } },
        { id: "end", type: "end", position: { x: 680, y: 240 }, data: { label: "END" } },
      ],
      edges: [{ id: "start-end", source: "start", target: "end", label: "" }],
    };
  }

  // Calculate bounding box to normalize coordinates into Agent Studio viewport
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of rawNodes) {
    if (Array.isArray(n.position)) {
      const [x, y] = n.position;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;

  // Coordinate scaling
  const scale = 0.85;
  const offsetX = 80;
  const offsetY = 100;

  const nodeMap = new Map<string, string>(); // n8n node.name -> studio node.id
  const studioNodes: GraphNodeDefinition[] = [];

  rawNodes.forEach((n, idx) => {
    const safeId = `n8n_${idx}_${(n.name || "node").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40)}`;
    nodeMap.set(n.name, safeId);

    const mappedType = mapN8nNodeType(n.type);
    const { prompt, description, allowedTools } = extractPromptOrDescription(n);

    const [nx = 0, ny = 0] = Array.isArray(n.position) ? n.position : [idx * 220, 150];
    const x = Math.round((nx - minX) * scale + offsetX);
    const y = Math.round((ny - minY) * scale + offsetY);

    const cleanLabel = (n.name || "Node").slice(0, 100);
    const cleanDesc = description ? description.slice(0, 900) : undefined;
    const cleanPrompt = prompt ? prompt.slice(0, 9000) : undefined;

    const httpUrl = String(n.parameters?.url || n.parameters?.path || "");
    const rawMethod = String(n.parameters?.httpMethod || "GET").toUpperCase();
    const validMethods: Array<"GET" | "POST" | "PUT" | "PATCH" | "DELETE"> = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    const httpMethod = validMethods.find((m) => m === rawMethod) || "GET";
    const noteContent = String(n.parameters?.content || "");

    studioNodes.push({
      id: safeId,
      type: mappedType,
      position: { x, y },
      data: {
        label: cleanLabel,
        description: cleanDesc,
        prompt: cleanPrompt,
        allowedTools: allowedTools ? allowedTools.slice(0, 20) : undefined,
        toolName: mappedType === "tool" ? n.type.replace(/^n8n-nodes-base\./, "").slice(0, 100) : undefined,
        httpUrl: mappedType === "http" ? httpUrl.slice(0, 1000) : undefined,
        httpMethod: mappedType === "http" ? httpMethod : undefined,
        noteContent: mappedType === "sticky_note" ? noteContent.slice(0, 9000) : undefined,
      },
    });
  });

  // Convert connections to studio edges
  const studioEdges: GraphEdgeDefinition[] = [];
  const edgeSet = new Set<string>();

  for (const [sourceName, outputs] of Object.entries(rawConnections)) {
    const sourceId = nodeMap.get(sourceName);
    if (!sourceId) continue;

    for (const [outputType, branchGroups] of Object.entries(outputs)) {
      if (!Array.isArray(branchGroups)) continue;

      branchGroups.forEach((branch, branchIndex) => {
        if (!Array.isArray(branch)) return;

        branch.forEach((targetConn) => {
          const targetId = nodeMap.get(targetConn.node);
          if (!targetId || sourceId === targetId) return;

          let edgeLabel = "";
          if (outputType === "main" && branchGroups.length > 1) {
            edgeLabel = branchIndex === 0 ? "True / Branch 1" : `Branch ${branchIndex + 1}`;
          } else if (outputType !== "main") {
            edgeLabel = outputType.replace(/_/g, " ");
          }

          const edgeId = `${sourceId}__${targetId}__${branchIndex}`;
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            studioEdges.push({
              id: edgeId,
              source: sourceId,
              target: targetId,
              label: edgeLabel,
            });
          }
        });
      });
    }
  }

  // 1. Ensure graph has at least one start node
  const hasStart = studioNodes.some((n) => n.type === "start");
  if (!hasStart && studioNodes.length > 0) {
    const firstNode = studioNodes[0];
    const startNode: GraphNodeDefinition = {
      id: "start_trigger",
      type: "start",
      position: { x: Math.max(20, firstNode.position.x - 220), y: firstNode.position.y },
      data: { label: "START TRIGGER", description: "Workflow entry point" },
    };
    studioNodes.unshift(startNode);
    studioEdges.unshift({
      id: `start_trigger__${firstNode.id}`,
      source: startNode.id,
      target: firstNode.id,
      label: "",
    });
  }

  // 2. Ensure graph has at least one end node (required by isValidGraph)
  const hasEnd = studioNodes.some((n) => n.type === "end");
  if (!hasEnd && studioNodes.length > 0) {
    // Find nodes with no outgoing edges (leaf nodes)
    const sourcesWithOutputs = new Set(studioEdges.map((e) => e.source));
    const nonAnnotationNodes = studioNodes.filter((n) => n.type !== "sticky_note" && n.type !== "start");
    const leafNodes = nonAnnotationNodes.filter((n) => !sourcesWithOutputs.has(n.id));

    const targets = leafNodes.length > 0 ? leafNodes : [studioNodes[studioNodes.length - 1]];
    const rightmostX = Math.max(...studioNodes.map((n) => n.position.x), 400);
    const avgY = targets.reduce((sum, n) => sum + n.position.y, 0) / targets.length;

    const endNode: GraphNodeDefinition = {
      id: "end_output",
      type: "end",
      position: { x: rightmostX + 240, y: Math.round(avgY) },
      data: { label: "END OUTPUT", description: "Workflow completion" },
    };
    studioNodes.push(endNode);

    targets.forEach((leaf, idx) => {
      studioEdges.push({
        id: `${leaf.id}__end_output__${idx}`,
        source: leaf.id,
        target: endNode.id,
        label: "",
      });
    });
  }

  // 3. Filter out any edges pointing to non-existent nodes
  const validNodeIds = new Set(studioNodes.map((n) => n.id));
  const cleanEdges = studioEdges.filter(
    (e) => validNodeIds.has(e.source) && validNodeIds.has(e.target) && e.source !== e.target
  );

  return {
    version: 1,
    nodes: studioNodes,
    edges: cleanEdges,
  };
}

/**
 * Converts an n8n workflow into an Agent Studio WorkflowTemplate.
 */
export function convertN8nToWorkflowTemplate(n8nWorkflow: N8nWorkflowData | Record<string, unknown>): WorkflowTemplate {
  const name = String(n8nWorkflow.name || "Untitled n8n Workflow").slice(0, 95);
  const desc = String(n8nWorkflow.description || "");
  const rawNodes: N8nNode[] = Array.isArray(n8nWorkflow.nodes)
    ? n8nWorkflow.nodes
    : Array.isArray((n8nWorkflow as Record<string, unknown>).workflow && ((n8nWorkflow as Record<string, unknown>).workflow as Record<string, unknown>).nodes)
    ? (((n8nWorkflow as Record<string, unknown>).workflow as Record<string, unknown>).nodes as N8nNode[])
    : [];

  const stepsSummary: string[] = rawNodes
    .filter((n) => !n.type?.includes("stickyNote"))
    .map((n) => (n.name || "Step").slice(0, 80))
    .slice(0, 10);

  const tools: string[] = (
    Array.from(
      new Set(
        rawNodes
          .map((n) => {
            const t = n.type || "";
            return t.replace(/^n8n-nodes-base\./, "").replace(/^@n8n\/n8n-nodes-langchain\./, "").replace(/[^a-zA-Z0-9_-]/g, "");
          })
          .filter((t: unknown): t is string => typeof t === "string" && t.length > 0)
      )
    ) as string[]
  ).slice(0, 15);

  const rawPurpose = desc.trim();
  const cleanPurpose = (rawPurpose.length < 5 ? `Automated workflow imported from n8n: ${name}` : rawPurpose).slice(0, 900);

  const baseInstructions = `Imported n8n workflow: ${name}.\n\nSteps:\n` + (stepsSummary.length > 0 ? stepsSummary.map((s, i) => `${i + 1}. ${s}`).join("\n") : "1. Execute automation flow.");
  const cleanInstructions = (baseInstructions.length < 5 ? `Execute imported workflow: ${name}` : baseInstructions).slice(0, 19000);

  return {
    id: `n8n_${n8nWorkflow.id || Date.now()}`,
    name,
    purpose: cleanPurpose,
    category: "OPERATIONS",
    badge: "N8N COMMUNITY · IMPORTED",
    stepsSummary: stepsSummary.length > 0 ? stepsSummary : ["Input", "Process", "Output"],
    instructions: cleanInstructions,
    inputSchema: {
      type: "object",
      properties: {
        payload: { type: "object", description: "Input payload to trigger the workflow" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        result: { type: "object", description: "Execution result" },
        status: { type: "string" },
      },
    },
    examples: [
      {
        input: { payload: { sample: "test_data" } },
        output: { status: "COMPLETED" },
      },
    ],
    allowedTools: tools.length > 0 ? tools : ["document_search", "web_search"],
    actionsRequiringApproval: [],
    maxExecutionSteps: Math.min(50, Math.max(10, rawNodes.length * 2)),
  };
}
