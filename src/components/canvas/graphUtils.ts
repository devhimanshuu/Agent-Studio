import type { Node, Edge } from "@xyflow/react";
import { AgentGraphDefinition, GraphNodeDefinition, GraphEdgeDefinition, GraphNodeType, createEmptyGraph } from "@/types/graph";
import { CANVAS_NODE_TYPE_MAP } from "./nodeTypes";

/** Extra client-side state carried on each React Flow node (never persisted). */
export interface CanvasNodeData {
  label: string;
  description?: string;
  prompt?: string;
  model?: string;
  customApiKey?: string;
  customApiBaseUrl?: string;
  customApiProvider?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  allowedTools?: string[];
  toolName?: string;
  action?: string;
  inputTemplate?: Record<string, unknown>;
  routerMode?: "deterministic" | "ai";
  condition?: string;
  routerPrompt?: string;
  approvalReason?: string;
  autoApproveCondition?: string;
  escalateAfterMin?: number;
  maxIterations?: number;
  parallelMode?: "map" | "reduce";
  mapField?: string;
  /** Nested graph executed by a subgraph (macro) node. */
  subgraph?: AgentGraphDefinition;
  /** Maps inner input variable → parent template (`{{ results.x.y }}`). */
  inputMapping?: Record<string, string>;
  /** Maps outer result key → inner result template (`results.<innerNodeId>.<path>`). */
  outputMapping?: Record<string, string>;
  // MCP & ecosystem fields
  mcpServerId?: string;
  mcpTransport?: "STDIO" | "SSE";
  mcpEndpoint?: string;
  mcpToolName?: string;
  mcpToolServer?: string;
  mcpToolParams?: Record<string, unknown>;
  skillId?: string;
  skillInput?: Record<string, unknown>;
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  httpUrl?: string;
  httpHeaders?: Record<string, string>;
  httpBody?: Record<string, unknown>;
  httpResponseType?: "json" | "text" | "blob";
  transformOp?: string;
  transformExpr?: string;
  delayMs?: number;
  delayTemplate?: string;
  aggregateMode?: string;
  aggregateExpr?: string;
  varName?: string;
  varOp?: string;
  varValue?: unknown;
  outputTemplate?: string;
  outputFields?: Record<string, string>;
  // Triggers
  cronExpression?: string;
  cronTimezone?: string;
  scheduleInterval?: string;
  webhookPath?: string;
  webhookMethod?: "POST" | "GET" | "PUT";
  webhookSecret?: string;
  // RSS & Web Ingestion
  rssUrl?: string;
  rssMaxItems?: number;
  readerUrl?: string;
  readerFormat?: "markdown" | "html" | "text";
  readerTargetSelector?: string;
  // Dispatch & Mapping
  dispatchDestination?: "discord" | "slack" | "telegram" | "webhook";
  dispatchWebhookUrl?: string;
  dispatchMessage?: string;
  dispatchChannel?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  mapperSchema?: Record<string, string>;
  mapperExpression?: string;
  // Open Source Tools & Microservices
  searxngHost?: string;
  searxngQuery?: string;
  searxngCategories?: string[];
  searxngLimit?: number;
  crawl4aiHost?: string;
  crawl4aiUrl?: string;
  crawl4aiSelector?: string;
  crawl4aiWordCountThreshold?: number;
  doclingHost?: string;
  doclingDocumentUrl?: string;
  doclingOutputFormat?: "markdown" | "json" | "html";
  doclingOcr?: boolean;
  gotenbergHost?: string;
  gotenbergHtmlContent?: string;
  gotenbergPaperSize?: "A4" | "Letter" | "Legal";
  gotenbergLandscape?: boolean;
  nocodbHost?: string;
  nocodbApiToken?: string;
  nocodbTableId?: string;
  nocodbOperation?: "list" | "create" | "find" | "update";
  nocodbData?: Record<string, unknown>;
  pocketbaseHost?: string;
  pocketbaseCollection?: string;
  pocketbaseAction?: "get" | "create" | "update" | "list";
  pocketbaseRecordId?: string;
  pocketbaseData?: Record<string, unknown>;
  qdrantHost?: string;
  qdrantCollection?: string;
  qdrantAction?: "search" | "upsert" | "count";
  qdrantQuery?: string;
  qdrantTopK?: number;
  audioTranscriberHost?: string;
  audioSourceUrl?: string;
  audioLanguage?: string;
  piperHost?: string;
  piperText?: string;
  piperVoice?: string;
  // Visual & Notes
  noteContent?: string;
  noteColor?: string;
  frameTitle?: string;
  frameOpacity?: number;
  containedNodeIds?: string[];
  /** Live trace status — only set in trace mode. */
  traceStatus?: "RUNNING" | "SUCCESS" | "FAILED" | "AWAITING_APPROVAL" | "SKIPPED";
  /** Live trace detail message. */
  traceDetail?: string;
  /** Heatmap mode: average latency for this node (ms). */
  heatmapLatency?: number;
  /** Heatmap mode: max average latency across the graph (scale anchor). */
  heatmapMax?: number;
  [key: string]: unknown;
}

export type CanvasNode = Node<CanvasNodeData>;

function nodeDataToGraphData(data: CanvasNodeData): GraphNodeDefinition["data"] {
  return {
    label: data.label ?? "UNNAMED",
    description: data.description,
    prompt: data.prompt,
    model: data.model,
    allowedTools: data.allowedTools,
    toolName: data.toolName,
    action: data.action,
    inputTemplate: data.inputTemplate,
    routerMode: data.routerMode,
    condition: data.condition,
    routerPrompt: data.routerPrompt,
    approvalReason: data.approvalReason,
    autoApproveCondition: data.autoApproveCondition,
    escalateAfterMin: data.escalateAfterMin,
    maxIterations: data.maxIterations,
    parallelMode: data.parallelMode,
    mapField: data.mapField,
    subgraph: data.subgraph,
    inputMapping: data.inputMapping,
    outputMapping: data.outputMapping,
    // MCP & ecosystem fields
    mcpServerId: data.mcpServerId,
    mcpTransport: data.mcpTransport,
    mcpEndpoint: data.mcpEndpoint,
    mcpToolName: data.mcpToolName,
    mcpToolServer: data.mcpToolServer,
    mcpToolParams: data.mcpToolParams,
    skillId: data.skillId,
    skillInput: data.skillInput,
    httpMethod: data.httpMethod,
    httpUrl: data.httpUrl,
    httpHeaders: data.httpHeaders,
    httpBody: data.httpBody,
    httpResponseType: data.httpResponseType,
    transformOp: data.transformOp,
    transformExpr: data.transformExpr,
    delayMs: data.delayMs,
    delayTemplate: data.delayTemplate,
    aggregateMode: data.aggregateMode,
    aggregateExpr: data.aggregateExpr,
    varName: data.varName,
    varOp: data.varOp,
    outputTemplate: data.outputTemplate,
    outputFields: data.outputFields,
    // Triggers
    cronExpression: data.cronExpression,
    cronTimezone: data.cronTimezone,
    scheduleInterval: data.scheduleInterval,
    webhookPath: data.webhookPath,
    webhookMethod: data.webhookMethod,
    webhookSecret: data.webhookSecret,
    // RSS & Web Ingestion
    rssUrl: data.rssUrl,
    rssMaxItems: data.rssMaxItems,
    readerUrl: data.readerUrl,
    readerFormat: data.readerFormat,
    readerTargetSelector: data.readerTargetSelector,
    // Dispatch & Mapping
    dispatchDestination: data.dispatchDestination,
    dispatchWebhookUrl: data.dispatchWebhookUrl,
    dispatchMessage: data.dispatchMessage,
    dispatchChannel: data.dispatchChannel,
    telegramBotToken: data.telegramBotToken,
    telegramChatId: data.telegramChatId,
    mapperSchema: data.mapperSchema,
    mapperExpression: data.mapperExpression,
    // Open Source Tools & Microservices
    searxngHost: data.searxngHost,
    searxngQuery: data.searxngQuery,
    searxngCategories: data.searxngCategories,
    searxngLimit: data.searxngLimit,
    crawl4aiHost: data.crawl4aiHost,
    crawl4aiUrl: data.crawl4aiUrl,
    crawl4aiSelector: data.crawl4aiSelector,
    crawl4aiWordCountThreshold: data.crawl4aiWordCountThreshold,
    doclingHost: data.doclingHost,
    doclingDocumentUrl: data.doclingDocumentUrl,
    doclingOutputFormat: data.doclingOutputFormat,
    doclingOcr: data.doclingOcr,
    gotenbergHost: data.gotenbergHost,
    gotenbergHtmlContent: data.gotenbergHtmlContent,
    gotenbergPaperSize: data.gotenbergPaperSize,
    gotenbergLandscape: data.gotenbergLandscape,
    nocodbHost: data.nocodbHost,
    nocodbApiToken: data.nocodbApiToken,
    nocodbTableId: data.nocodbTableId,
    nocodbOperation: data.nocodbOperation,
    nocodbData: data.nocodbData,
    pocketbaseHost: data.pocketbaseHost,
    pocketbaseCollection: data.pocketbaseCollection,
    pocketbaseAction: data.pocketbaseAction,
    pocketbaseRecordId: data.pocketbaseRecordId,
    pocketbaseData: data.pocketbaseData,
    qdrantHost: data.qdrantHost,
    qdrantCollection: data.qdrantCollection,
    qdrantAction: data.qdrantAction,
    qdrantQuery: data.qdrantQuery,
    qdrantTopK: data.qdrantTopK,
    audioTranscriberHost: data.audioTranscriberHost,
    audioSourceUrl: data.audioSourceUrl,
    audioLanguage: data.audioLanguage,
    piperHost: data.piperHost,
    piperText: data.piperText,
    piperVoice: data.piperVoice,
    // Visual & Notes
    noteContent: data.noteContent,
    noteColor: data.noteColor,
    frameTitle: data.frameTitle,
    frameOpacity: data.frameOpacity,
    containedNodeIds: data.containedNodeIds,
  };
}

/** Convert a persisted graph definition into React Flow nodes/edges. */
export function graphToFlow(graph: AgentGraphDefinition | null | undefined): { nodes: CanvasNode[]; edges: Edge[] } {
  const g = graph && Array.isArray(graph.nodes) && graph.nodes.length > 0 ? graph : createEmptyGraph();
  const nodes: CanvasNode[] = g.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: { ...n.data, traceStatus: undefined, traceDetail: undefined } as CanvasNodeData,
  }));
  const edges: Edge[] = g.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    type: "smoothstep",
    animated: false,
    labelStyle: { fontSize: 10, fontFamily: "monospace" },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  }));
  return { nodes, edges };
}

/** Convert React Flow nodes/edges into a persisted graph definition. */
export function flowToGraph(nodes: CanvasNode[], edges: Edge[]): AgentGraphDefinition {
  const graphNodes: GraphNodeDefinition[] = nodes.map((n) => ({
    id: n.id,
    type: (n.type ?? "agent") as GraphNodeType,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    data: nodeDataToGraphData(n.data),
  }));
  const graphEdges: GraphEdgeDefinition[] = edges
    .filter((e) => e.source && e.target)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" && e.label.trim() ? e.label.trim() : undefined,
    }));
  return { version: 1, nodes: graphNodes, edges: graphEdges };
}

/** Default width for a node type (used by the auto-layout). */
export function nodeDefaultSize(type: string): { width: number; height: number } {
  switch (type) {
    case "start":
    case "end":
      return { width: 140, height: 52 };
    case "agent":
    case "supervisor":
      return { width: 240, height: 128 };
    case "tool":
      return { width: 220, height: 116 };
    case "router":
      return { width: 220, height: 112 };
    case "approval":
      return { width: 220, height: 104 };
    case "loop":
      return { width: 200, height: 96 };
    case "parallel":
      return { width: 220, height: 104 };
    case "subgraph":
      return { width: 220, height: 100 };
    case "sticky_note":
      return { width: 240, height: 160 };
    case "frame":
      return { width: 400, height: 300 };
    default:
      return { width: 220, height: 100 };
  }
}

/** Create a fresh node id like `agent_1`, `router_2`, unique within the graph. */
export function nextNodeId(type: GraphNodeType, existing: CanvasNode[]): string {
  const used = new Set(existing.map((n) => n.id));
  let i = 1;
  while (used.has(`${type}_${i}`)) i += 1;
  return `${type}_${i}`;
}

/** Create a fresh edge id. */
export function nextEdgeId(existing: Edge[]): string {
  const used = new Set(existing.map((e) => e.id));
  let i = 1;
  while (used.has(`edge_${i}`)) i += 1;
  return `edge_${i}`;
}

/** Build a new node from a palette type at a canvas position. */
export function createNodeFromType(
  type: GraphNodeType,
  position: { x: number; y: number },
  existing: CanvasNode[]
): CanvasNode {
  const meta = CANVAS_NODE_TYPE_MAP[type];
  const id = nextNodeId(type, existing);
  const { width, height } = nodeDefaultSize(type);
  return {
    id,
    type,
    position,
    data: {
      label: meta.label,
      ...(meta.defaults as Record<string, unknown>),
    } as CanvasNodeData,
    measured: { width, height },
  };
}
