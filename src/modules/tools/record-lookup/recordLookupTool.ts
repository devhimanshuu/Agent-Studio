import { Tool } from "../interfaces/Tool";
import {
  RecordEntity,
  recordLookupInputValidator,
  recordLookupInputSchema,
  recordLookupOutputSchema,
} from "../validators/recordLookup";

type RecordRow = Record<string, string | number | null>;

/** Mock structured database — employees, customers, orders, banks, audit reports. */
const MOCK_DB: Record<RecordEntity, RecordRow[]> = {
  employees: [
    { id: "EMP-001", name: "Ada Lovelace", department: "Engineering", role: "Staff Engineer", email: "ada@agent.studio", status: "ACTIVE" },
    { id: "EMP-002", name: "Alan Turing", department: "Research", role: "Principal Researcher", email: "alan@agent.studio", status: "ACTIVE" },
    { id: "EMP-003", name: "Grace Hopper", department: "Engineering", role: "Engineering Manager", email: "grace@agent.studio", status: "ON_LEAVE" },
    { id: "EMP-004", name: "Katherine Johnson", department: "Data", role: "Data Scientist", email: "katherine@agent.studio", status: "ACTIVE" },
  ],
  customers: [
    { id: "CUS-001", name: "Northwind Labs", tier: "enterprise", region: "EMEA", email: "billing@northwind.io" },
    { id: "CUS-002", name: "Acme Corp", tier: "growth", region: "NA", email: "billing@acme.com" },
    { id: "CUS-003", name: "Globex Systems", tier: "enterprise", region: "APAC", email: "finance@globex.sys" },
    { id: "CUS-004", name: "Initech", tier: "starter", region: "NA", email: "billing@initech.co" },
  ],
  orders: [
    { id: "ORD-001", customerId: "CUS-001", amount: 4200, status: "SHIPPED", createdAt: "2026-06-12" },
    { id: "ORD-002", customerId: "CUS-002", amount: 950, status: "PENDING", createdAt: "2026-07-01" },
    { id: "ORD-003", customerId: "CUS-003", amount: 18750, status: "SHIPPED", createdAt: "2026-07-15" },
    { id: "ORD-004", customerId: "CUS-002", amount: 340, status: "CANCELLED", createdAt: "2026-05-28" },
  ],
  banks: [
    { id: "BNK-001", name: "Federal Reserve", country: "US", swift: "FRNBBOSX" },
    { id: "BNK-002", name: "Deutsche Bank", country: "DE", swift: "DEUTDEFF" },
    { id: "BNK-003", name: "Mitsubishi UFJ", country: "JP", swift: "BOTKJPJT" },
  ],
  audit_reports: [
    { id: "AUD-001", title: "Q2 Platform Security Review", scope: "auth, permissions", status: "COMPLETED", completedAt: "2026-07-20" },
    { id: "AUD-002", title: "LLM Provider Dependency Audit", scope: "groq, openrouter", status: "COMPLETED", completedAt: "2026-06-30" },
    { id: "AUD-003", title: "Approval Workflow Compliance", scope: "hitl, idempotency", status: "IN_PROGRESS", completedAt: null },
  ],
};

function matchRow(row: RecordRow, query: string): boolean {
  const q = query.toLowerCase();
  return Object.values(row).some((value) => String(value).toLowerCase().includes(q));
}

/** Mock structured database lookup. Exact `id` match wins; otherwise a
 * case-insensitive substring search across all fields, returned as JSON. */
export const recordLookupTool: Tool = {
  id: "record_lookup",
  name: "record_lookup",
  displayName: "Record Lookup",
  description:
    "Structured lookup over mock records — employees, customers, orders, banks, and audit reports. Exact id match or field search, returned as JSON.",
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
    const rows = MOCK_DB[parsed.entity];
    const limit = parsed.limit ?? 10;

    let records: RecordRow[];
    if (parsed.id) {
      records = rows.filter((row) => String(row.id).toLowerCase() === parsed.id!.toLowerCase());
    } else if (parsed.search) {
      records = rows.filter((row) => matchRow(row, parsed.search!));
    } else {
      records = [...rows];
    }

    const limited = records.slice(0, limit);
    return {
      entity: parsed.entity,
      query: parsed.id ?? parsed.search ?? "",
      count: limited.length,
      records: limited,
    };
  },

  async healthCheck() {
    const started = Date.now();
    try {
      await recordLookupTool.execute({ entity: "employees", id: "EMP-001" });
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
