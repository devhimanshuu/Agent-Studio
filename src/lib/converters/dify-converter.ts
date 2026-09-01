import * as yaml from "js-yaml";
import { logger } from "@/lib/logger";
import { AgentGraphDefinition, GraphEdgeDefinition, GraphNodeDefinition, GraphNodeType } from "@/types/graph";
import { WorkflowTemplate } from "@/components/workflows/WorkflowTemplates";

interface DifyNodeData {
  title?: string;
  type?: string;
  variables?: unknown[];
  outputs?: unknown[];
  model?: {
    name?: string;
    provider?: string;
    mode?: string;
  };
  prompt_template?: unknown;
  provider_id?: string;
  provider_name?: string;
  provider_type?: string;
  tool_name?: string;
  params?: Record<string, unknown>;
  code?: string;
  code_language?: string;
  conditions?: unknown[];
  logical_operator?: string;
  iterator_selector?: unknown;
  output_type?: string;
  template?: string;
  memory?: unknown;
  [key: string]: unknown;
}

export interface DifyNode {
  id: string;
  type?: string;
  position?: { x: number; y: number } | [number, number];
  positionAbsolute?: { x: number; y: number };
  width?: number;
  height?: number;
  data?: DifyNodeData;
  selected?: boolean;
}

export interface DifyEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: {
    sourceType?: string;
    targetType?: string;
    isInIteration?: boolean;
    conditionId?: string;
    label?: string;
  };
}

export interface DifyWorkflowData {
  version?: string;
  app?: {
    name?: string;
    description?: string;
    icon?: string;
    icon_background?: string;
    mode?: string;
  };
  workflow?: {
    graph?: {
      nodes?: DifyNode[];
      edges?: DifyEdge[];
    };
    features?: Record<string, unknown>;
    conversation_variables?: unknown[];
    environment_variables?: unknown[];
  };
  dependencies?: unknown[];
}

/**
 * Robust YAML/JSON parser for Dify DSL files
 */
export function parseDifyDslYaml(yamlText: string): DifyWorkflowData {
  if (!yamlText || typeof yamlText !== "string") return {};

  const trimmed = yamlText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed) as DifyWorkflowData;
    } catch {
      // Fall through to YAML parse
    }
  }

  try {
    const parsed = yaml.load(yamlText);
    return parsed && typeof parsed === "object" ? (parsed as DifyWorkflowData) : {};
  } catch (err) {
    logger.warn({ err }, "Dify DSL YAML parse error");
    return {};
  }
}

/**
 * Maps a Dify node type string to an Agent Studio GraphNodeType.
 */
function mapDifyNodeType(difyType: string): GraphNodeType {
  const t = (difyType || "").toLowerCase();

  if (t === "llm" || t.includes("model") || t.includes("generate")) return "agent";
  if (t === "tool" || t.includes("tool") || t === "http-request" || t === "api-call") return "tool";
  if (t === "code" || t === "custom_code" || t === "script") return "transform";
  if (t === "if-else" || t === "condition" || t === "router" || t === "branch") return "router";
  if (t === "question-classifier" || t === "classifier") return "router";
  if (t === "iteration" || t === "loop") return "loop";
  if (t === "human-in-the-loop" || t === "approval" || t === "moderation") return "approval";
  if (t === "knowledge-retrieval" || t === "rag" || t === "search") return "tool";
  if (t === "template-transform" || t === "transform" || t === "assigner") return "transform";
  if (t === "variable-aggregator" || t === "merge") return "subgraph";
  if (t === "document-extractor" || t === "docling") return "docling_pdf_parser";
  if (t === "pdf-generator" || t === "gotenberg") return "gotenberg_pdf_exporter";
  if (t === "webhook" || t === "trigger") return "webhook_trigger";
  if (t === "rss" || t === "feed") return "rss_feed";
  if (t === "web-reader" || t === "jina") return "web_reader";
  if (t === "notify" || t === "notification" || t === "discord" || t === "slack") return "notification_dispatcher";
  if (t === "nocodb") return "nocodb_record";
  if (t === "pocketbase") return "pocketbase_store";

  return "tool";
}

/**
 * Converts a Dify Workflow DSL (nodes + edges) into an Agent Studio AgentGraphDefinition.
 */
export function convertDifyToAgentGraph(difyWorkflow: DifyWorkflowData): AgentGraphDefinition {
  const graphData =
    difyWorkflow.workflow?.graph ||
    ((difyWorkflow as Record<string, unknown>).graph as { nodes?: DifyNode[]; edges?: DifyEdge[] } | undefined) ||
    {};
  const rawNodes: DifyNode[] = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const rawEdges: DifyEdge[] = Array.isArray(graphData.edges) ? graphData.edges : [];

  const convertedNodes: GraphNodeDefinition[] = [];
  const convertedEdges: GraphEdgeDefinition[] = [];

  rawNodes.forEach((node, index) => {
    const rawData = node.data || {};
    const nodeType = mapDifyNodeType(rawData.type || node.type || "tool");

    let posX = 100 + (index % 4) * 260;
    let posY = 100 + Math.floor(index / 4) * 180;

    if (node.position) {
      if (Array.isArray(node.position) && node.position.length >= 2) {
        posX = node.position[0];
        posY = node.position[1];
      } else if (typeof node.position === "object" && "x" in node.position && typeof node.position.x === "number") {
        posX = node.position.x;
        posY = node.position.y;
      }
    } else if (node.positionAbsolute) {
      posX = node.positionAbsolute.x;
      posY = node.positionAbsolute.y;
    }

    const title = rawData.title || node.id || `Dify Node ${index + 1}`;
    const desc =
      rawData.model?.name
        ? `Model: ${rawData.model.name} (${rawData.model.provider || "LLM"})`
        : rawData.provider_name
        ? `Tool: ${rawData.provider_name} / ${rawData.tool_name || "action"}`
        : rawData.code_language
        ? `Script (${rawData.code_language})`
        : `${rawData.type || "workflow"} step`;

    convertedNodes.push({
      id: String(node.id),
      type: nodeType,
      position: { x: posX, y: posY },
      data: {
        label: title,
        description: desc,
        prompt: typeof rawData.prompt_template === "string" ? rawData.prompt_template : undefined,
        model: rawData.model?.name,
        toolName: rawData.tool_name || rawData.provider_name,
        condition: rawData.conditions ? JSON.stringify(rawData.conditions) : undefined,
      },
    });
  });

  rawEdges.forEach((edge, index) => {
    if (!edge.source || !edge.target) return;

    convertedEdges.push({
      id: edge.id || `dify_e_${edge.source}_${edge.target}_${index}`,
      source: String(edge.source),
      target: String(edge.target),
      label: edge.data?.label || edge.data?.conditionId,
    });
  });

  // Ensure start and end node if empty
  if (convertedNodes.length === 0) {
    convertedNodes.push(
      {
        id: "start",
        type: "start",
        position: { x: 100, y: 150 },
        data: { label: "Start Trigger", description: "Workflow input entrypoint" },
      },
      {
        id: "dify_agent",
        type: "agent",
        position: { x: 400, y: 150 },
        data: {
          label: difyWorkflow.app?.name || "Dify Agent",
          description: difyWorkflow.app?.description || "Imported Dify LLM Node",
          model: "meta-llama/llama-3.3-70b-versatile",
        },
      },
      {
        id: "end",
        type: "end",
        position: { x: 700, y: 150 },
        data: { label: "Complete", description: "Workflow output resolution" },
      }
    );

    convertedEdges.push(
      { id: "e_start_agent", source: "start", target: "dify_agent" },
      { id: "e_agent_end", source: "dify_agent", target: "end" }
    );
  }

  return {
    version: 1,
    nodes: convertedNodes,
    edges: convertedEdges,
  };
}

/**
 * Converts Dify template metadata into an Agent Studio WorkflowTemplate.
 */
export function convertDifyToWorkflowTemplate(template: Record<string, unknown>): WorkflowTemplate {
  const dslParsed =
    typeof template.dsl === "string"
      ? parseDifyDslYaml(template.dsl)
      : (template.dsl as DifyWorkflowData) || (template as DifyWorkflowData);

  const graph = convertDifyToAgentGraph(dslParsed);
  const categories = (template.categories as string[]) || [];
  const rawCat = (categories[0] || "OPERATIONS").toUpperCase();
  const validCat: WorkflowTemplate["category"] =
    rawCat === "FINANCE" || rawCat === "COMPLIANCE" || rawCat === "SUPPORT"
      ? rawCat
      : "OPERATIONS";

  const templateId = String(template.id || "imported");
  const templateName = String(template.template_name || template.name || `Dify Template #${templateId}`);
  const overview = String(template.overview || template.description || "Imported Dify workflow template");
  const badges = Array.isArray(template.badges) ? (template.badges as string[]) : [];

  return {
    id: `dify-${templateId}`,
    name: templateName,
    purpose: overview.slice(0, 280),
    category: validCat,
    badge: badges.includes("partner") ? "PARTNER BLUEPRINT" : "COMMUNITY WORKFLOW",
    stepsSummary: graph.nodes.map((n) => n.data.label || n.type).slice(0, 7),
    instructions: String(template.readme || overview || "Execute Dify imported workflow").slice(0, 500),
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: {} },
    examples: [],
    allowedTools: Array.isArray(template.deps_plugins) ? (template.deps_plugins as string[]) : [],
    actionsRequiringApproval: [],
    maxExecutionSteps: 50,
  };
}
