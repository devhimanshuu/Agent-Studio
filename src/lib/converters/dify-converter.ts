import yaml from "js-yaml";
import { AgentGraphDefinition, GraphEdgeDefinition, GraphNodeDefinition, GraphNodeType } from "@/types/graph";
import { WorkflowTemplate } from "@/components/workflows/WorkflowTemplates";

export interface DifyNodeData {
  title?: string;
  type?: string;
  variables?: any[];
  outputs?: any[];
  model?: {
    name?: string;
    provider?: string;
    mode?: string;
  };
  prompt_template?: any;
  provider_id?: string;
  provider_name?: string;
  provider_type?: string;
  tool_name?: string;
  params?: Record<string, any>;
  code?: string;
  code_language?: string;
  conditions?: any[];
  logical_operator?: string;
  iterator_selector?: any;
  output_type?: string;
  template?: string;
  memory?: any;
  [key: string]: any;
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
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: {
    sourceType?: string;
    targetType?: string;
    isInIteration?: boolean;
    isInLoop?: boolean;
  };
}

export interface DifyWorkflowData {
  id?: string;
  name?: string;
  description?: string;
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
    features?: Record<string, any>;
    conversation_variables?: any[];
    environment_variables?: any[];
  };
  dependencies?: any[];
}

/**
 * Robust YAML/JSON parser for Dify DSL files
 */
export function parseDifyDslYaml(yamlText: string): any {
  if (!yamlText || typeof yamlText !== "string") return {};

  const trimmed = yamlText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to YAML parse
    }
  }

  try {
    const parsed = yaml.load(yamlText);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("[parseDifyDslYaml] YAML parse error:", err);
    return {};
  }
}

/**
 * Maps a Dify node type string to an Agent Studio GraphNodeType.
 */
export function mapDifyNodeType(difyType: string): GraphNodeType {
  const t = (difyType || "").toLowerCase();

  if (
    t === "start" ||
    t.includes("trigger") ||
    t.includes("webhook") ||
    t.includes("schedule") ||
    t === "user-input"
  ) {
    return "start";
  }

  if (t === "end" || t === "output" || t === "answer") {
    return "end";
  }

  if (
    t === "llm" ||
    t === "agent" ||
    t === "question-classifier" ||
    t === "parameter-extractor" ||
    t.includes("knowledge")
  ) {
    return "agent";
  }

  if (
    t === "tool" ||
    t === "document-extractor" ||
    t === "list-operator" ||
    t === "doc-extractor"
  ) {
    return "tool";
  }

  if (t === "http-request" || t === "http") {
    return "http";
  }

  if (
    t === "code" ||
    t === "template-transform" ||
    t === "variable-aggregator" ||
    t === "variable-assigner" ||
    t === "assigner"
  ) {
    return "transform";
  }

  if (t === "if-else" || t === "switch") {
    return "router";
  }

  if (t === "human-input" || t === "approval") {
    return "approval";
  }

  if (t === "iteration" || t === "loop") {
    return "loop";
  }

  if (t === "note") {
    return "sticky_note";
  }

  return "tool";
}

/**
 * Converts a raw Dify workflow DSL into an Agent Studio GraphDefinition
 */
export function convertDifyToAgentGraph(difyWorkflow: DifyWorkflowData): AgentGraphDefinition {
  const graphData = difyWorkflow.workflow?.graph || (difyWorkflow as any).graph || {};
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
      } else if (typeof (node.position as any).x === "number") {
        posX = (node.position as any).x;
        posY = (node.position as any).y;
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
        prompt:
          typeof rawData.prompt_template === "string"
            ? rawData.prompt_template
            : rawData.prompt_template?.template || rawData.prompt_template?.text,
        allowedTools: rawData.provider_name ? [rawData.provider_name] : [],
        toolName: rawData.tool_name || rawData.provider_name,
        transformExpr: rawData.code,
      },
    });
  });

  rawEdges.forEach((edge, i) => {
    if (edge.source && edge.target) {
      convertedEdges.push({
        id: edge.id || `edge-${edge.source}-${edge.target}-${i}`,
        source: String(edge.source),
        target: String(edge.target),
        label: edge.data?.sourceType || undefined,
      });
    }
  });

  // Fallback: If no edges were defined, chain nodes sequentially
  if (convertedEdges.length === 0 && convertedNodes.length > 1) {
    for (let i = 0; i < convertedNodes.length - 1; i++) {
      convertedEdges.push({
        id: `auto-edge-${convertedNodes[i].id}-${convertedNodes[i + 1].id}`,
        source: convertedNodes[i].id,
        target: convertedNodes[i + 1].id,
      });
    }
  }

  // Ensure start node exists
  if (!convertedNodes.some((n) => n.type === "start") && convertedNodes.length > 0) {
    convertedNodes[0].type = "start";
  }

  // Ensure end node exists
  if (!convertedNodes.some((n) => n.type === "end") && convertedNodes.length > 1) {
    convertedNodes[convertedNodes.length - 1].type = "end";
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
export function convertDifyToWorkflowTemplate(template: any): WorkflowTemplate {
  const dslParsed =
    typeof template.dsl === "string"
      ? parseDifyDslYaml(template.dsl)
      : template.dsl || template;

  const graph = convertDifyToAgentGraph(dslParsed);
  const categories = template.categories || [];
  const rawCat = (categories[0] || "OPERATIONS").toUpperCase();
  const validCat: WorkflowTemplate["category"] =
    rawCat === "FINANCE" || rawCat === "COMPLIANCE" || rawCat === "SUPPORT"
      ? rawCat
      : "OPERATIONS";

  return {
    id: `dify-${template.id}`,
    name: template.template_name || template.name || `Dify Template #${template.id}`,
    purpose: (template.overview || template.description || "Imported Dify workflow template").slice(0, 280),
    category: validCat,
    badge: template.badges?.includes("partner") ? "PARTNER BLUEPRINT" : "COMMUNITY WORKFLOW",
    stepsSummary: graph.nodes.map((n) => n.data.label || n.type).slice(0, 7),
    instructions: template.readme || (template.overview || "Execute Dify imported workflow").slice(0, 500),
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: {} },
    examples: [],
    allowedTools: template.deps_plugins || [],
    actionsRequiringApproval: [],
    maxExecutionSteps: 50,
  };
}
