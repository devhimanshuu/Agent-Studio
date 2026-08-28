import { Tool } from "../interfaces/Tool";
import { documentSearchInputValidator, documentSearchInputSchema, documentSearchOutputSchema } from "../validators/documentSearch";
import { pgVectorStore } from "@/modules/rag/pgvectorStore";

/**
 * Real document search tool — uses PostgreSQL pgvector for semantic vector search
 * across ingested documents and knowledge bases, with hybrid fallback to PostgreSQL
 * full-text search across executions, MCP, and audit logs.
 */
export const documentSearchTool: Tool = {
  id: "document_search",
  name: "document_search",
  displayName: "Document Search",
  description:
    "Semantic search over ingested documents and knowledge bases using pgvector, combined with PostgreSQL system history retrieval. Returns ranked results with relevance scores.",
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
    const limit = parsed.limit ?? 5;

    // 1. Search pgvector knowledge base
    try {
      const vectorResults = await pgVectorStore.search(parsed.query, {
        limit,
        minScore: 0.15,
      });

      if (vectorResults.length > 0) {
        return {
          query: parsed.query,
          total: vectorResults.length,
          results: vectorResults.map((r) => ({
            title: r.title || "Document Chunk",
            snippet: r.content.slice(0, 250),
            relevance: r.score,
            source: `pgvector:${r.collection}`,
          })),
          source: "postgresql",
        };
      }
    } catch {
      // Fall through to system search
    }

    // 2. Search PostgreSQL system entities
    return searchPostgres(parsed.query, limit);
  },

  async healthCheck() {
    const started = Date.now();
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "healthy",
        latencyMs: Date.now() - started,
        source: "postgresql",
      };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  },
};

async function searchPostgres(query: string, limit: number) {
  const { prisma } = await import("@/lib/prisma");

  const searchResults: Array<{
    title: string;
    snippet: string;
    relevance: number;
    source: string;
  }> = [];

  // Search executions
  const executions = await prisma.execution.findMany({
    take: Math.min(limit, 3),
    where: {
      OR: [
        { skillName: { contains: query, mode: "insensitive" } },
        { id: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      skillName: true,
      status: true,
      startedAt: true,
    },
    orderBy: { startedAt: "desc" },
  });

  for (const e of executions) {
    searchResults.push({
      title: `Execution: ${e.skillName ?? "Unknown"}`,
      snippet: `Status: ${e.status}, Started: ${e.startedAt.toISOString()}`,
      relevance: 0.8,
      source: "executions",
    });
  }

  // Search audit logs
  const auditLogs = await prisma.auditLog.findMany({
    take: Math.min(limit, 3),
    where: {
      OR: [
        { action: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      action: true,
      timestamp: true,
    },
    orderBy: { timestamp: "desc" },
  });

  for (const log of auditLogs) {
    searchResults.push({
      title: `Audit: ${log.action}`,
      snippet: `Recorded at ${log.timestamp.toISOString()}`,
      relevance: 0.6,
      source: "audit_logs",
    });
  }

  // Search MCP servers
  const servers = await prisma.mcpServer.findMany({
    take: Math.min(limit, 3),
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { endpointUrl: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      transport: true,
    },
  });

  for (const s of servers) {
    searchResults.push({
      title: `MCP Server: ${s.name}`,
      snippet: `Transport: ${s.transport}, Status: ${s.status}`,
      relevance: 0.7,
      source: "mcp_servers",
    });
  }

  const sorted = searchResults
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  return {
    query,
    total: sorted.length,
    results: sorted,
    source: "postgresql",
  };
}
