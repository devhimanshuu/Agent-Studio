import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLLMProvider } from "@/providers/llm";
import { McpServerRepository } from "@/repositories/McpServerRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { AuditLogRepository } from "@/repositories/AuditLogRepository";
import { SkillService } from "@/services/SkillService";
import { createSkillSchema } from "@/validators/skillSchema";
import type { AgentGraphDefinition } from "@/types/graph";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const mcpRepo = new McpServerRepository();
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);

// ────────────── LLM Prompt for Graph + Server Discovery ──────────────

const SYNTHESIZER_SYSTEM_PROMPT = `You are a multi-agent workflow architect. Given a natural language description of a goal, you must:

1. **Identify required MCP servers** — extract the services/tools needed (e.g., GitHub, Postgres, Slack, Stripe, etc.)
2. **Generate a complete AgentGraphDefinition** — a visual multi-agent graph with proper nodes, edges, routing, and approval gates.

## Response Format

Return a JSON object with this EXACT structure:

{
  "analysis": {
    "goal": "one-line summary of what the workflow does",
    "servers": [
      {
        "name": "GitHub",
        "searchQuery": "github",
        "purpose": "What this server provides to the workflow",
        "category": "SCM"
      }
    ],
    "steps": [
      "Step 1: Monitor GitHub for new issues",
      "Step 2: Classify issue priority using AI",
      "Step 3: Route high-priority to Slack alert"
    ]
  },
  "graph": {
    "version": 1,
    "nodes": [...],
    "edges": [...]
  },
  "skillName": "Suggested Skill Name",
  "skillPurpose": "One-line purpose for the skill record"
}

## Graph Node Rules

### Node Types Available:
- **start** — Graph entry point (required, exactly 1)
- **end** — Terminal node (required, at least 1)
- **agent** — LLM agent with a system prompt. Use for reasoning, classification, summarization
- **supervisor** — LLM that routes to next node by edge label. Use for orchestration
- **tool** — Deterministic tool call (calculator, search, etc.)
- **router** — Conditional branch: deterministic (condition expression) or AI (prompt-based)
- **approval** — Human-in-the-loop gate. ALWAYS use this for: sending messages, modifying data, financial operations, external API writes
- **loop** — Iterate up to N times (with body and exit edges)
- **parallel** — Fan-out/fan-in for concurrent operations
- **mcp_tool** — Call a specific MCP tool (use for GitHub, Postgres, Slack, etc.)

### MCP Tool Node Rules:
For each MCP server identified, create an mcp_tool node with:
- mcpToolName: the actual tool name (e.g., "create_issue", "search_repositories", "query", "send_message")
- mcpToolServer: the server name (e.g., "github", "postgresql", "slack")
- mcpToolParams: template parameters using {{ results.nodeId.field }} syntax

### Layout Rules:
- Position nodes left-to-right: start at x=80, increment x by ~280 per column
- Stack vertically when branching: increment y by ~160
- Keep the graph well-connected and readable

### Edge Rules:
- Router/supervisor edges MUST have labels (e.g., "true"/"false" or branch names)
- Every node must be reachable from start and able to reach end

### Important:
- For ANY action that sends messages, posts content, modifies data, or makes external calls, include an **approval** node before it
- Use AI routers for intelligent classification/routing when the logic is non-trivial
- Use deterministic routers for simple condition checks
- Agent prompts should be specific and detailed, not generic

Return ONLY the JSON, no markdown fences, no explanation.`;

// ────────────── Keyword extraction for directory search ──────────────

const SERVICE_KEYWORDS: Record<string, string[]> = {
  github: ["github", "git", "repository", "repo", "pr", "pull request", "issue", "commit", "branch"],
  slack: ["slack", "message", "chat", "channel", "team notification", "alert", "dm"],
  postgresql: ["postgres", "postgresql", "database", "db", "sql", "query", "table"],
  stripe: ["stripe", "payment", "billing", "invoice", "subscription", "checkout"],
  notion: ["notion", "document", "wiki", "knowledge base", "page", "database"],
  docker: ["docker", "container", "image", "compose", "containerize"],
  kubernetes: ["kubernetes", "k8s", "pod", "deployment", "cluster", "helm"],
  jira: ["jira", "ticket", "issue tracker", "sprint", "backlog"],
  linear: ["linear", "issue", "project management", "sprint"],
  sentry: ["sentry", "error tracking", "exception", "crash", "monitoring"],
  openai: ["openai", "gpt", "llm", "chatgpt", "ai model", "embedding"],
  pinecone: ["pinecone", "vector", "embedding", "similarity search", "rag"],
  snowflake: ["snowflake", "data warehouse", "analytics", "olap"],
  bigquery: ["bigquery", "google cloud", "gcp", "data analysis"],
  firebase: ["firebase", "firestore", "realtime database", "authentication"],
  supabase: ["supabase", "postgres", "database", "auth", "realtime"],
  googlecalendar: ["calendar", "meeting", "event", "schedule", "appointment"],
  twitter: ["twitter", "x", "tweet", "social media", "post"],
  email: ["email", "mail", "smtp", "newsletter", "drip", "campaign"],
  hubspot: ["hubspot", "crm", "lead", "contact", "deal"],
  salesforce: ["salesforce", "crm", "lead", "opportunity"],
  aws: ["aws", "s3", "lambda", "ec2", "cloudwatch", "dynamodb"],
  google_drive: ["google drive", "drive", "file storage", "folder"],
  dropbox: ["dropbox", "file storage", "cloud storage"],
  twilio: ["twilio", "sms", "phone", "voice", "call"],
  pagerduty: ["pagerduty", "incident", "on-call", "escalation"],
  datadog: ["datadog", "monitoring", "apm", "logs", "metrics"],
  cloudflare: ["cloudflare", "cdn", "waf", "dns", "ddos"],
  brave_search: ["brave", "search", "web search", "internet"],
  confluence: ["confluence", "wiki", "documentation", "knowledge base"],
};

function extractServiceKeywords(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const found: string[] = [];

  for (const [service, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        found.push(service);
        break;
      }
    }
  }

  return [...new Set(found)];
}

/**
 * POST /api/skills/synthesize
 *
 * Body: { prompt: string, autoMount?: boolean }
 *
 * Flow:
 * 1. Parse the NL prompt with LLM to extract server needs + graph structure
 * 2. Search MCP directory for matching servers
 * 3. Return the graph, recommended servers, and analysis
 * 4. If autoMount=true, also mount servers and create the skill
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { prompt, autoMount = false } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    logger.info({ userId, promptLength: prompt.length }, "Skill synthesis started");

    // ── Phase 1: LLM generates graph + server analysis ──
    const llm = getLLMProvider();
    const llmResponse = await llm.complete(
      [
        { role: "system", content: SYNTHESIZER_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, maxTokens: 6000 }
    );

    let jsonStr = llmResponse.content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let result: {
      analysis: {
        goal: string;
        servers: Array<{ name: string; searchQuery: string; purpose: string; category: string }>;
        steps: string[];
      };
      graph: AgentGraphDefinition;
      skillName: string;
      skillPurpose: string;
    };

    try {
      result = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to parse LLM output as JSON" },
        { status: 422 }
      );
    }

    // Validate graph structure
    if (!result.graph?.nodes || !result.graph?.edges) {
      return NextResponse.json(
        { success: false, error: "Generated graph is missing nodes or edges" },
        { status: 422 }
      );
    }

    // Ensure graph version and IDs
    result.graph.version = 1;
    result.graph.nodes = result.graph.nodes.map((n, i) => ({
      ...n,
      id: n.id || `node_${i}`,
      type: n.type || "agent",
      position: n.position || { x: 100 + i * 280, y: 200 },
      data: { ...n.data, label: n.data?.label || n.id || `Node ${i}` },
    }));
    result.graph.edges = result.graph.edges.map((e, i) => ({
      ...e,
      id: e.id || `edge_${i + 1}`,
    }));

    // Also extract keywords via keyword matching as a fallback/supplement
    const keywordMatches = extractServiceKeywords(prompt);
    const llmServers = result.analysis?.servers || [];

    // Merge: LLM-detected servers + keyword-matched servers
    const allServerNames = new Set([
      ...llmServers.map((s) => s.searchQuery.toLowerCase()),
      ...keywordMatches,
    ]);

    // ── Phase 2: Search MCP directory for matching servers ──
    const matchedServers: Array<{
      name: string;
      searchQuery: string;
      purpose: string;
      category: string;
      directoryMatch?: {
        id: string;
        name: string;
        source: string;
        endpointUrl?: string;
        command?: string;
        transport: string;
        description: string;
        tags: string[];
        stars: number;
      };
    }> = [];

    for (const serverInfo of llmServers) {
      try {
        const searchUrl = new URL("/api/mcp/directory", request.url);
        searchUrl.searchParams.set("q", serverInfo.searchQuery);
        searchUrl.searchParams.set("source", "ALL");

        const dirRes = await fetch(searchUrl).then((r) => r.json());
        const matches = dirRes.data || [];

        // Find best match
        const bestMatch = matches.find((s: { name: string }) =>
          s.name.toLowerCase().includes(serverInfo.searchQuery.toLowerCase())
        ) || matches[0];

        matchedServers.push({
          ...serverInfo,
          directoryMatch: bestMatch
            ? {
                id: bestMatch.id,
                name: bestMatch.name,
                source: bestMatch.source,
                endpointUrl: bestMatch.endpointUrl,
                command: bestMatch.command,
                transport: bestMatch.endpointUrl ? "SSE" : "STDIO",
                description: bestMatch.description,
                tags: bestMatch.tags || [],
                stars: bestMatch.stars || 0,
              }
            : undefined,
        });
      } catch (err) {
        logger.warn({ server: serverInfo.name, error: err }, "Directory search failed");
        matchedServers.push({
          ...serverInfo,
          directoryMatch: undefined,
        });
      }
    }

    // ── Phase 3: Auto-mount servers if requested ──
    const mountedServerIds: string[] = [];

    if (autoMount) {
      const existingRes = await mcpRepo.findByUserId(userId);
      const existingServers = existingRes;

      for (const server of matchedServers) {
        try {
          // Check if already connected
          const existing = existingServers.find(
            (s) => s.name.toLowerCase().includes(server.searchQuery.toLowerCase())
          );

          if (existing) {
            mountedServerIds.push(existing.id);
            continue;
          }

          if (!server.directoryMatch) continue;

          const dm = server.directoryMatch;
          const transport = dm.endpointUrl ? "SSE" : "STDIO";
          const postBody: Record<string, unknown> = {
            name: dm.name,
            transport,
            connectOnCreate: true,
          };
          if (transport === "SSE" && dm.endpointUrl) postBody.endpointUrl = dm.endpointUrl;
          if (transport === "STDIO" && dm.command) postBody.command = dm.command;

          const serverRes = await fetch(new URL("/api/mcp/servers", request.url), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(postBody),
          }).then((r) => r.json());

          if (serverRes.success && serverRes.data?.id) {
            mountedServerIds.push(serverRes.data.id);
          }
        } catch (err) {
          logger.warn({ server: server.name, error: err }, "Server mount failed");
        }
      }

      // ── Phase 4: Create the skill record ──
      const allowedTools = new Set<string>();
      for (const sid of mountedServerIds) {
        allowedTools.add(`mcp_${sid}_*`);
      }
      allowedTools.add("*");

      const instructions = [
        `# ${result.skillName || "Synthesized Workflow"}`,
        "",
        `**Goal:** ${result.analysis?.goal || prompt}`,
        "",
        "## Required Servers",
        ...matchedServers.map((s) => `- **${s.name}**: ${s.purpose}`),
        "",
        "## Workflow Steps",
        ...(result.analysis?.steps || []).map((step) => `${step}`),
        "",
        "---",
        "*Generated by Skill Synthesizer from natural language description.*",
      ].join("\n");

      const safeName = (result.skillName || "Synthesized Skill").slice(0, 100);
      const safePurpose = (result.skillPurpose || result.analysis?.goal || prompt).slice(0, 1000);

      try {
        const validated = createSkillSchema.parse({
          userId,
          name: safeName,
          purpose: safePurpose,
          instructions: instructions.slice(0, 20000),
          allowedTools: Array.from(allowedTools).slice(0, 30),
          graphDefinition: result.graph,
          maxExecutionSteps: Math.max(20, result.graph.nodes.length * 3),
          notes: `Generated by Skill Synthesizer from: "${prompt.slice(0, 200)}"`,
        });

        const skill = await skillService.createSkill(validated);

        // Audit log
        await auditRepo.log({
          userId,
          action: "SKILL_SYNTHESIZED",
          details: {
            skillId: skill.id,
            promptLength: prompt.length,
            serversFound: matchedServers.length,
            serversMounted: mountedServerIds.length,
            graphNodes: result.graph.nodes.length,
            graphEdges: result.graph.edges.length,
          },
        });

        return NextResponse.json({
          success: true,
          data: {
            analysis: result.analysis,
            graph: result.graph,
            skillName: safeName,
            skillPurpose: safePurpose,
            servers: matchedServers,
            mountedServerIds,
            skillId: skill.id,
          },
        });
      } catch (err) {
        // Skill creation failed, but we still have the graph and servers
        logger.error({ error: err }, "Skill creation failed during synthesis");
        return NextResponse.json({
          success: true,
          data: {
            analysis: result.analysis,
            graph: result.graph,
            skillName: safeName,
            skillPurpose: safePurpose,
            servers: matchedServers,
            mountedServerIds,
            skillId: null,
            warning: `Graph generated but skill creation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        });
      }
    }

    // ── Return without auto-mount ──
    return NextResponse.json({
      success: true,
      data: {
        analysis: result.analysis,
        graph: result.graph,
        skillName: result.skillName,
        skillPurpose: result.skillPurpose,
        servers: matchedServers,
        mountedServerIds: [],
        skillId: null,
      },
    });
  } catch (error) {
    logger.error({ error }, "Skill synthesis failed");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Synthesis failed",
      },
      { status: 500 }
    );
  }
}
