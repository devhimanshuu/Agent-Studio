import { Tool } from "../interfaces/Tool";
import { documentSearchInputValidator, documentSearchInputSchema, documentSearchOutputSchema } from "../validators/documentSearch";

interface KnowledgeDoc {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

/** Mock knowledge base for the Agent Studio platform. */
const KNOWLEDGE_BASE: KnowledgeDoc[] = [
  {
    id: "doc-skills",
    title: "Skill Management",
    tags: ["skills", "create", "publish", "version", "draft", "schema"],
    content:
      "Reusable AI Skills are versioned units: define name, purpose, instructions, input/output JSON schemas, examples, allowed tools, and max execution steps. Drafts can be edited; publishing freezes the version.",
  },
  {
    id: "doc-approvals",
    title: "Approval Workflow (HITL)",
    tags: ["approvals", "hitl", "human", "idempotency", "write"],
    content:
      "Write actions pause for human approval. Each approval request carries a single-use idempotency key enforced atomically — a request can never be responded to twice. Approvals are ownership-scoped to the requesting user.",
  },
  {
    id: "doc-tools",
    title: "Tool Registry",
    tags: ["tools", "registry", "calculator", "document_search", "record_lookup", "task_creator", "permission"],
    content:
      "The runtime executes tools only through the registry. Built-ins: calculator, document_search, record_lookup, mock_task_creator. Every tool implements one interface; new tools plug in by registering.",
  },
  {
    id: "doc-runtime",
    title: "Graph-First Agent Runtime",
    tags: ["runtime", "graph", "langgraph", "nodes", "planner", "execution"],
    content:
      "Executions are LangGraph pipelines: planner, permission, tool_selection, tool_execution, approval, finish. Strongly typed agent state flows through nodes; every node persists a timeline step and structured logs.",
  },
  {
    id: "doc-failover",
    title: "LLM Auto-Failover",
    tags: ["llm", "providers", "groq", "openrouter", "failover", "cooldown", "models"],
    content:
      "The planner routes across 12 free models (Groq + OpenRouter). On failure the router parks the vendor in cooldown (429→60s, 5xx→30s, 404→10min, bad key→vendor park) and fails over — a single model failure never fails a run.",
  },
  {
    id: "doc-permissions",
    title: "Permission Boundary",
    tags: ["permission", "allowedTools", "security", "blocked", "enabled"],
    content:
      "Before any tool executes, the permission node verifies the tool exists, is enabled, is listed in the skill's allowedTools, and is not blocked. Unauthorized tool calls are rejected before they can run.",
  },
];

/** Expanded vocabulary so keyword search approximates semantic matching
 * (e.g. "hitl" finds the approvals doc). */
const SYNONYMS: Record<string, string[]> = {
  hitl: ["approval", "approve", "human"],
  llm: ["provider", "model", "ai"],
  graph: ["runtime", "langgraph", "node"],
  registry: ["tools", "tool"],
  calculator: ["math", "arithmetic"],
  failover: ["cooldown", "retry", "fallback"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);
}

/** Expand a query into a set of weighted search terms. */
function expandTerms(query: string): string[] {
  const terms = tokenize(query);
  const expanded = new Set<string>();
  for (const term of terms) {
    expanded.add(term);
    for (const alias of SYNONYMS[term] ?? []) expanded.add(alias);
  }
  return [...expanded];
}

function scoreDoc(doc: KnowledgeDoc, terms: string[]): number {
  const title = doc.title.toLowerCase();
  const tagText = doc.tags.join(" ").toLowerCase();
  const content = doc.content.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 3;
    if (tagText.includes(term)) score += 2;
    if (content.includes(term)) score += 1;
  }
  return score;
}

function snippet(doc: KnowledgeDoc): string {
  const trimmed = doc.content.length > 140 ? `${doc.content.slice(0, 140).trimEnd()}…` : doc.content;
  return trimmed;
}

/** Mock knowledge-base search. Keyword scoring + synonym expansion for a
 * semantic-search simulation, ranked by relevance and capped at 1. */
export const documentSearchTool: Tool = {
  id: "document_search",
  name: "document_search",
  displayName: "Document Search",
  description:
    "Searches a mock knowledge base about the platform. Keyword matching with synonym expansion, ranked by relevance with a snippet.",
  category: "SEARCH",
  type: "READ",
  inputSchema: documentSearchInputSchema,
  outputSchema: documentSearchOutputSchema,
  requiresApproval: false,
  enabled: true,

  validate(input) {
    const parsed = documentSearchInputValidator.safeParse(input);
    if (parsed.success) return [];
    return parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  },

  async execute(input) {
    const parsed = documentSearchInputValidator.parse(input);
    const terms = expandTerms(parsed.query);
    const limit = parsed.limit ?? 5;

    if (terms.length === 0) {
      return { query: parsed.query, total: 0, results: [] };
    }

    const scored = KNOWLEDGE_BASE.map((doc) => ({ doc, score: scoreDoc(doc, terms) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));

    const maxScore = scored[0]?.score ?? 1;
    const results = scored.slice(0, limit).map(({ doc, score }) => ({
      title: doc.title,
      snippet: snippet(doc),
      relevance: Math.min(1, Math.round((score / maxScore) * 100) / 100),
    }));

    return { query: parsed.query, total: scored.length, results };
  },

  async healthCheck() {
    const started = Date.now();
    try {
      await documentSearchTool.execute({ query: "tool registry", limit: 1 });
      return { status: "healthy", latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  },
};
