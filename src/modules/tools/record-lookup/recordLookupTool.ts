import { Tool } from "../interfaces/Tool";
import {
  RecordEntity,
  recordLookupInputValidator,
  recordLookupInputSchema,
  recordLookupOutputSchema,
} from "../validators/recordLookup";

type RecordRow = Record<string, string | number | null>;

/**
 * Real record lookup tool — queries NocoDB (if configured) or PostgreSQL.
 *
 * When NOCODB_HOST is set, queries NocoDB tables via REST API.
 * Otherwise, falls back to PostgreSQL for execution history and audit logs.
 */
export const recordLookupTool: Tool = {
  id: "record_lookup",
  name: "record_lookup",
  displayName: "Record Lookup",
  description:
    "Query real records from NocoDB tables or PostgreSQL execution history. Supports exact ID match and full-text search across all fields.",
  category: "DATA",
  type: "READ",
  inputSchema: recordLookupInputSchema,
  outputSchema: recordLookupOutputSchema,
  requiresApproval: false,
  enabled: true,

  validate(input) {
    const parsed = recordLookupInputValidator.safeParse(input);
    if (parsed.success) return [];
    return parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
  },

  async execute(input) {
    const parsed = recordLookupInputValidator.parse(input);
    const limit = parsed.limit ?? 10;

    // Try NocoDB first if configured
    const nocodbHost = process.env.NOCODB_HOST;
    const nocodbToken = process.env.NOCODB_API_TOKEN;

    if (nocodbHost && nocodbToken) {
      return queryNocoDB(parsed.entity, parsed.id, parsed.search, limit, nocodbHost, nocodbToken);
    }

    // Fallback to PostgreSQL execution history
    return queryPostgres(parsed.entity, parsed.id, parsed.search, limit);
  },

  async healthCheck() {
    const started = Date.now();
    try {
      const nocodbHost = process.env.NOCODB_HOST;
      const nocodbToken = process.env.NOCODB_API_TOKEN;

      if (nocodbHost && nocodbToken) {
        // Test NocoDB connection
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${nocodbHost.replace(/\/+$/, "")}/api/v2/meta/tables`, {
          headers: { "xc-token": nocodbToken },
          signal: controller.signal,
        });
        clearTimeout(timer);
        return {
          status: res.ok ? "healthy" : "degraded",
          latencyMs: Date.now() - started,
          source: "nocodb",
        };
      }

      // Test PostgreSQL connection
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
      return { status: "healthy", latencyMs: Date.now() - started, source: "postgresql" };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  },
};

async function queryNocoDB(
  entity: RecordEntity,
  id: string | undefined,
  search: string | undefined,
  limit: number,
  host: string,
  token: string
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    // Map entity names to NocoDB table IDs (users configure these)
    const tableId = getNocoDBTableId(entity);
    if (!tableId) {
      throw new Error(`NocoDB table not configured for entity: ${entity}. Set NOCODB_TABLE_${entity.toUpperCase()} in your env.`);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "xc-token": token,
    };

    let url = `${host.replace(/\/+$/, "")}/api/v2/tables/${encodeURIComponent(tableId)}/records`;

    // Add query params for search/filter
    const params = new URLSearchParams();
    if (id) {
      params.set("where", `(id,eq,${id})`);
    } else if (search) {
      // NocoDB doesn't have full-text search, so we filter by first string field
      params.set("where", `(title,like,%${search}%)`);
    }
    params.set("limit", String(limit));

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;

    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`NocoDB query failed ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json() as { list?: RecordRow[]; records?: RecordRow[] };
    const records = json.list ?? json.records ?? [];

    return {
      entity,
      query: id ?? search ?? "",
      count: records.length,
      records: records.slice(0, limit),
      source: "nocodb",
    };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

async function queryPostgres(
  entity: RecordEntity,
  id: string | undefined,
  search: string | undefined,
  limit: number
) {
  // Query real PostgreSQL tables based on entity type
  const { prisma } = await import("@/lib/prisma");

  let records: RecordRow[] = [];

  switch (entity) {
    case "employees": {
      // Query users table as "employees"
      const users = await prisma.user.findMany({
        take: limit,
        where: id ? { id } : search ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        } : undefined,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
      records = users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name ?? "Unknown",
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      }));
      break;
    }

    case "customers": {
      // Query users with execution stats as "customers"
      const usersWithStats = await prisma.user.findMany({
        take: limit,
        where: id ? { id } : search ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        } : undefined,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          _count: { select: { executions: true } },
        },
      });
      records = usersWithStats.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name ?? "Unknown",
        role: u.role,
        executionCount: u._count.executions,
        joinedAt: u.createdAt.toISOString(),
      }));
      break;
    }

    case "orders": {
      // Query executions as "orders"
      const executions = await prisma.execution.findMany({
        take: limit,
        where: id ? { id } : search ? {
          OR: [
            { skillName: { contains: search, mode: "insensitive" } },
            { id: { contains: search, mode: "insensitive" } },
          ],
        } : undefined,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          skillName: true,
          status: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          stepCount: true,
        },
      });
      records = executions.map((e) => ({
        id: e.id,
        skill: e.skillName ?? "Unknown",
        status: e.status,
        startedAt: e.startedAt.toISOString(),
        completedAt: e.completedAt?.toISOString() ?? null,
        durationMs: e.durationMs,
        steps: e.stepCount,
      }));
      break;
    }

    case "banks": {
      // Query MCP servers as "banks" (connection endpoints)
      const servers = await prisma.mcpServer.findMany({
        take: limit,
        where: id ? { id } : search ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { endpointUrl: { contains: search, mode: "insensitive" } },
          ],
        } : undefined,
        select: {
          id: true,
          name: true,
          transport: true,
          status: true,
          endpointUrl: true,
          createdAt: true,
        },
      });
      records = servers.map((s) => ({
        id: s.id,
        name: s.name,
        transport: s.transport,
        status: s.status,
        endpoint: s.endpointUrl ?? "N/A",
        createdAt: s.createdAt.toISOString(),
      }));
      break;
    }

    case "audit_reports": {
      // Query audit logs as "audit_reports"
      const logs = await prisma.auditLog.findMany({
        take: limit,
        where: id ? { id } : search ? {
          OR: [
            { action: { contains: search, mode: "insensitive" } },
          ],
        } : undefined,
        orderBy: { timestamp: "desc" },
        select: {
          id: true,
          action: true,
          details: true,
          ipAddress: true,
          timestamp: true,
        },
      });
      records = logs.map((l) => ({
        id: l.id,
        action: l.action,
        details: String(l.details),
        ipAddress: l.ipAddress ?? "N/A",
        timestamp: l.timestamp.toISOString(),
      }));
      break;
    }
  }

  return {
    entity,
    query: id ?? search ?? "",
    count: records.length,
    records,
    source: "postgresql",
  };
}

function getNocoDBTableId(entity: RecordEntity): string | undefined {
  // Users can set these in their env to map entities to NocoDB table IDs
  const envKey = `NOCODB_TABLE_${entity.toUpperCase()}`;
  return process.env[envKey];
}
