/**
 * Visual Multi-Agent Graph — the persisted definition of an agent architecture
 * designed on the canvas. A skill version that carries a `graphDefinition`
 * executes through the graph interpreter instead of the linear planner.
 */

export type GraphNodeType =
  | "start"
  | "end"
  | "agent"
  | "supervisor"
  | "tool"
  | "router"
  | "approval"
  | "loop"
  | "parallel"
  | "subgraph"
  | "mcp_server"
  | "mcp_tool"
  | "skill"
  | "http"
  | "transform"
  | "delay"
  | "aggregate"
  | "variable"
  | "output"
  | "rss_feed"
  | "web_reader"
  | "notification_dispatcher"
  | "data_mapper"
  | "schedule_trigger"
  | "webhook_trigger"
  | "searxng_search"
  | "crawl4ai_scrape"
  | "docling_pdf_parser"
  | "gotenberg_pdf_exporter"
  | "nocodb_record"
  | "pocketbase_store"
  | "qdrant_vector_memory"
  | "audio_transcriber"
  | "piper_tts"
  | "a2a_delegate"
  | "a2a_channel"
  | "sticky_note"
  | "frame";

/** Router node evaluation modes. */
type RouterMode = "deterministic" | "ai";

/** Parallel (map-reduce) node modes. */
type ParallelMode = "map" | "reduce";

/** Per-type configuration stored in a node's `data`. */
export interface GraphNodeData {
  label: string;
  /** Short role description shown under the label on the canvas. */
  description?: string;
  // agent / supervisor
  /** System prompt for the LLM agent node. */
  prompt?: string;
  /** Explicit model override (e.g. `cohere/north-mini-code:free`, `google/gemma-4-26b-a4b-it:free`). */
  model?: string;
  /** Custom API Key for proprietary or self-hosted model endpoints. */
  customApiKey?: string;
  /** Custom API Base URL (e.g. `http://localhost:11434/v1`, `https://api.openai.com/v1`, `https://api.together.xyz/v1`). */
  customApiBaseUrl?: string;
  /** Provider identifier or protocol format (e.g. `custom_openai`, `ollama`, `together`, `groq`, `anthropic`). */
  customApiProvider?: string;
  /** Sampling temperature (0.0 - 2.0). */
  temperature?: number;
  /** Max output tokens for LLM generation. */
  maxTokens?: number;
  /** Top-P nucleus sampling. */
  topP?: number;
  /** Tool names the agent may invoke (resolved to registry tools at runtime). */
  allowedTools?: string[];
  // tool
  toolName?: string;
  action?: string;
  /** Input template — values may reference state via `{{ results.<nodeId>.<path> }}` or `{{ input.<path> }}`. */
  inputTemplate?: Record<string, unknown>;
  // router
  routerMode?: RouterMode;
  /** Deterministic condition expression (e.g. `results.classifier.decision == "high"`). */
  condition?: string;
  /** For AI routing — prompt asking the model to choose one of the outgoing edge labels. */
  routerPrompt?: string;
  // approval
  /** Human-readable approval request reason. */
  approvalReason?: string;
  /** When set, the gate auto-passes if this condition is true (HITL escalation rule). */
  autoApproveCondition?: string;
  /** Minutes before a pending request auto-escalates (expires off the queue). */
  escalateAfterMin?: number;
  // loop
  maxIterations?: number;
  // parallel
  parallelMode?: ParallelMode;
  /** For map mode — path to the array to iterate (e.g. `input.items`). */
  mapField?: string;
  // subgraph
  /** The nested graph executed when this node runs. */
  subgraph?: AgentGraphDefinition;
  /** Maps inner input variable → parent template (`{{ results.x.y }}`, `{{ input.z }}`). */
  inputMapping?: Record<string, string>;
  /** Maps outer result key → inner result template (`results.<innerNodeId>.<path>`). */
  outputMapping?: Record<string, string>;
  // mcp_server
  /** MCP server ID to connect to (from preset or directory). */
  mcpServerId?: string;
  /** MCP server transport type. */
  mcpTransport?: "STDIO" | "SSE";
  /** MCP server endpoint URL or command. */
  mcpEndpoint?: string;
  // mcp_tool
  /** Name of the MCP tool to call. */
  mcpToolName?: string;
  /** MCP server to call the tool from. */
  mcpToolServer?: string;
  /** Input parameters for the MCP tool (JSON template). */
  mcpToolParams?: Record<string, unknown>;
  // skill
  /** Skill ID to execute. */
  skillId?: string;
  /** Skill input data (JSON template). */
  skillInput?: Record<string, unknown>;
  // http
  /** HTTP method. */
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** HTTP endpoint URL (supports template strings). */
  httpUrl?: string;
  /** HTTP request headers (JSON). */
  httpHeaders?: Record<string, string>;
  /** HTTP request body (JSON template). */
  httpBody?: Record<string, unknown>;
  /** Expected response type. */
  httpResponseType?: "json" | "text" | "blob";
  /** Per-request wall-clock budget in ms. Default 30s, capped by the run timeout. */
  httpTimeoutMs?: number;
  // transform
  /** Transform operation type. */
  transformOp?: string;
  /** Transform expression or field path. */
  transformExpr?: string;
  // rss_feed
  /** RSS or Atom feed URL to ingest. */
  rssUrl?: string;
  /** Max items to fetch from the RSS feed (default 10). */
  rssMaxItems?: number;
  // web_reader
  /** Target URL to scrape and convert into LLM-ready markdown using Jina Reader (https://r.jina.ai/<url>). */
  readerUrl?: string;
  /** Reader format mode: markdown, html, or text. */
  readerFormat?: "markdown" | "html" | "text";
  /** Optional target CSS selector or sub-path. */
  readerTargetSelector?: string;
  // notification_dispatcher
  /** Dispatch destination channel. */
  dispatchDestination?: "discord" | "slack" | "telegram" | "webhook";
  /** Target webhook or endpoint URL. */
  dispatchWebhookUrl?: string;
  /** Message content or template to send. */
  dispatchMessage?: string;
  /** Optional channel override or sender label. */
  dispatchChannel?: string;
  /** Telegram Bot API token (for telegram destination). */
  telegramBotToken?: string;
  /** Telegram chat or channel ID. */
  telegramChatId?: string;
  // data_mapper
  /** Key-value mapping pairs: target field -> source expression / template. */
  mapperSchema?: Record<string, string>;
  /** Optional JSONPath or JS transform expression. */
  mapperExpression?: string;
  // schedule_trigger
  /** Standard 5-field cron expression (e.g. '0 9 * * *'). */
  cronExpression?: string;
  /** Cron timezone string (default UTC). */
  cronTimezone?: string;
  /** Human readable interval description (e.g. 'Every day at 9:00 AM'). */
  scheduleInterval?: string;
  // webhook_trigger
  /** Inbound webhook path / route identifier. */
  webhookPath?: string;
  /** Accepted HTTP method for inbound trigger. */
  webhookMethod?: "POST" | "GET" | "PUT";
  /** Expected payload schema or secret token. */
  webhookSecret?: string;
  // searxng_search
  /** SearXNG instance URL (e.g. 'https://searx.be' or 'http://localhost:8080'). */
  searxngHost?: string;
  /** Search query template string. */
  searxngQuery?: string;
  /** Categories to search (e.g. ['general', 'science', 'news', 'it']). */
  searxngCategories?: string[];
  /** Max results to return (default 5). */
  searxngLimit?: number;
  // crawl4ai_scrape
  /** Crawl4AI / Scraper API service endpoint or target URL. */
  crawl4aiHost?: string;
  /** Target page URL to crawl. */
  crawl4aiUrl?: string;
  /** Optional CSS selector or extraction strategy. */
  crawl4aiSelector?: string;
  /** Word count threshold for content filtering. */
  crawl4aiWordCountThreshold?: number;
  // docling_pdf_parser
  /** Docling microservice endpoint or document URL. */
  doclingHost?: string;
  /** Document / PDF URL or file path to parse. */
  doclingDocumentUrl?: string;
  /** Output format (markdown, json, html). */
  doclingOutputFormat?: "markdown" | "json" | "html";
  /** Whether to enable OCR table parsing. */
  doclingOcr?: boolean;
  // gotenberg_pdf_exporter
  /** Gotenberg PDF conversion instance URL. */
  gotenbergHost?: string;
  /** HTML / Markdown content template to render to PDF. */
  gotenbergHtmlContent?: string;
  /** Paper size: A4, Letter, Legal. */
  gotenbergPaperSize?: "A4" | "Letter" | "Legal";
  /** Page orientation: portrait or landscape. */
  gotenbergLandscape?: boolean;
  // nocodb_record
  /** NocoDB API host URL (e.g. 'http://localhost:8080' or cloud instance). */
  nocodbHost?: string;
  /** NocoDB API Token / Auth Key. */
  nocodbApiToken?: string;
  /** NocoDB Base / Table ID or Name. */
  nocodbTableId?: string;
  /** Operation: list, create, find, update. */
  nocodbOperation?: "list" | "create" | "find" | "update";
  /** Record payload or query parameters (JSON template). */
  nocodbData?: Record<string, unknown>;
  // pocketbase_store
  /** PocketBase instance host URL (e.g. 'http://127.0.0.1:8090'). */
  pocketbaseHost?: string;
  /** PocketBase Collection name. */
  pocketbaseCollection?: string;
  /** Action: get, create, update, list. */
  pocketbaseAction?: "get" | "create" | "update" | "list";
  /** Record ID for get/update. */
  pocketbaseRecordId?: string;
  /** Record payload or query filters (JSON template). */
  pocketbaseData?: Record<string, unknown>;
  /** PocketBase auth token for protected collections. */
  pocketbaseAuthToken?: string;
  // qdrant_vector_memory
  /** Qdrant instance URL (e.g. 'http://localhost:6333'). */
  qdrantHost?: string;
  /** Qdrant Collection Name. */
  qdrantCollection?: string;
  /** Action: search, upsert, count. */
  qdrantAction?: "search" | "upsert" | "count";
  /** Query text or semantic search template. */
  qdrantQuery?: string;
  /** Limit top K results (default 3). */
  qdrantTopK?: number;
  /** Qdrant API key for authenticated instances. */
  qdrantApiKey?: string;
  // audio_transcriber (Faster-Whisper)
  /** Faster-Whisper / Audio API host endpoint. */
  audioTranscriberHost?: string;
  /** Audio source URL or file base64 template. */
  audioSourceUrl?: string;
  /** Language hint (e.g. 'en', 'auto'). */
  audioLanguage?: string;
  // piper_tts
  /** Piper TTS service host endpoint. */
  piperHost?: string;
  /** Text template to synthesize into speech. */
  piperText?: string;
  /** Voice model identifier (e.g. 'en_US-lessac-medium'). */
  piperVoice?: string;
  // delay
  /** Delay duration in milliseconds. */
  delayMs?: number;
  /** Delay duration as a template string (e.g. `{{ input.delay }}`). */
  delayTemplate?: string;
  // aggregate
  /** How to combine results from incoming branches. */
  aggregateMode?: string;
  /** Custom aggregation expression (JS). */
  aggregateExpr?: string;
  // variable
  /** Variable name to get or set. */
  varName?: string;
  /** Operation: get or set. */
  varOp?: string;
  /** Value to set (JSON template). */
  varValue?: unknown;
  // output
  /** Output format template. */
  outputTemplate?: string;
  /** Output field mappings. */
  outputFields?: Record<string, string>;
  // sticky_note
  /** Markdown content for the sticky note. */
  noteContent?: string;
  /** Background color for the sticky note. */
  noteColor?: string;
  // frame
  /** Frame title / section label. */
  frameTitle?: string;
  /** Frame background opacity (0-1). */
  frameOpacity?: number;
  /** IDs of nodes contained within this frame (visual grouping). */
  containedNodeIds?: string[];
  // a2a_delegate
  /** Target A2A Agent Endpoint URL (e.g. 'https://agent.google.com/a2a' or 'http://localhost:3000/api/a2a'). */
  a2aAgentUrl?: string;
  /** Specific capability ID requested from the remote agent. */
  a2aCapability?: string;
  /** Authentication token / API key for the remote A2A agent. */
  a2aAuthToken?: string;
  /** SLA timeout for delegated task in milliseconds. */
  a2aTimeoutMs?: number;
  /** Fallback strategy if remote agent is unreachable or fails. */
  a2aFallbackStrategy?: "fail" | "skip" | "retry" | "local_agent";
  // a2a_channel
  /** Dialogue & orchestration mode for the A2A channel. */
  a2aChannelMode?: "round_robin" | "debate" | "consensus" | "delegation";
  /** Discussion topic or shared objective for the channel. */
  a2aChannelTopic?: string;
  /** Maximum number of dialogue turns before synthesizing group conclusion. */
  a2aMaxTurns?: number;
  /** Array of participant agent endpoints / names. */
  a2aParticipants?: Array<{ name: string; agentUrl: string; role: string; authToken?: string }>;
  // breakpoint
  /** Whether this node has a breakpoint set (debug mode). */
  breakpoint?: boolean;
  // token tracking
  /** Token usage stats for this node during execution. */
  tokenUsage?: { inputTokens?: number; outputTokens?: number; totalCost?: number; model?: string; };
  /** Streaming text token from LLM. */
  streamingText?: string;
  /** Whether this node is currently streaming. */
  isStreaming?: boolean;
}

export interface GraphNodeDefinition {
  id: string;
  type: GraphNodeType;
  position: { x: number; y: number };
  data: GraphNodeData;
}

/** One directed connection between nodes. `label` is the branch condition shown on the edge. */
export interface GraphEdgeDefinition {
  id: string;
  source: string;
  target: string;
  /** Branch label — routers/supervisors pick outgoing edges by label. */
  label?: string;
}

export interface AgentGraphDefinition {
  /** Schema version — currently 1. */
  version: 1;
  nodes: GraphNodeDefinition[];
  edges: GraphEdgeDefinition[];
}

/** Validates a graph has the minimal structure required to execute. */
export function isValidGraph(graph: AgentGraphDefinition | null | undefined): graph is AgentGraphDefinition {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return false;
  if (graph.nodes.length === 0) return false;
  const ids = new Set(graph.nodes.map((n) => n.id));
  const hasStart = graph.nodes.some((n) => n.type === "start");
  const hasEnd = graph.nodes.some((n) => n.type === "end");
  const edgesValid = graph.edges.every((e) => ids.has(e.source) && ids.has(e.target));
  return hasStart && hasEnd && edgesValid;
}

/** Build a minimal executable graph: start -> end. */
export function createEmptyGraph(): AgentGraphDefinition {
  return {
    version: 1,
    nodes: [
      { id: "start", type: "start", position: { x: 40, y: 260 }, data: { label: "START" } },
      { id: "end", type: "end", position: { x: 720, y: 260 }, data: { label: "END" } },
    ],
    edges: [{ id: "start-end", source: "start", target: "end", label: "" }],
  };
}
