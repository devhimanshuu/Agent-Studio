import { PrismaClient, Role, SkillStatus, ToolType, ExecutionStatus, McpTransport, McpServerStatus, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Agent Studio Database Seed...");

  // 1. Seed System Tools
  const tools = [
    {
      name: "calculator",
      displayName: "Math Calculator",
      description: "Safely evaluates mathematical expressions and numerical formulas.",
      category: "COMPUTE",
      type: ToolType.READ,
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "Mathematical expression to evaluate" },
        },
        required: ["expression"],
      },
      requiresApproval: false,
      isSystem: true,
    },
    {
      name: "document_search",
      displayName: "Knowledge Base Search",
      description: "Queries internal document database and vector store for knowledge base articles.",
      category: "SEARCH",
      type: ToolType.READ,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or keyword phrase" },
        },
        required: ["query"],
      },
      requiresApproval: false,
      isSystem: true,
    },
    {
      name: "record_lookup",
      displayName: "Record Lookup",
      description: "Queries structured database records and customer profile entities by ID or query.",
      category: "DATA",
      type: ToolType.READ,
      parameters: {
        type: "object",
        properties: {
          recordId: { type: "string", description: "Record ID or customer entity identifier" },
        },
        required: ["recordId"],
      },
      requiresApproval: false,
      isSystem: true,
    },
    {
      name: "mock_task_creator",
      displayName: "Task & Ticket Creator",
      description: "Creates actionable work items, tickets, and tasks. Requires Human-in-the-Loop approval.",
      category: "TASK",
      type: ToolType.WRITE,
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the task or ticket" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        },
        required: ["title"],
      },
      requiresApproval: true,
      isSystem: true,
    },
    {
      name: "ai_extraction",
      displayName: "AI Extraction",
      description: "Extracts structured JSON entities and fields from unstructured text or prior step results.",
      category: "DATA",
      type: ToolType.READ,
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          fieldsToExtract: { type: "array", items: { type: "string" } },
        },
        required: ["text", "fieldsToExtract"],
      },
      requiresApproval: false,
      isSystem: true,
    },
    {
      name: "ai_classification",
      displayName: "AI Classification",
      description: "Classifies text into bounded discrete categories with confidence and decision rationale.",
      category: "DATA",
      type: ToolType.READ,
      parameters: {
        type: "object",
        properties: {
          input: { type: "string" },
          categories: { type: "array", items: { type: "string" } },
        },
        required: ["input", "categories"],
      },
      requiresApproval: false,
      isSystem: true,
    },
    {
      name: "deterministic_condition",
      displayName: "Deterministic Condition Evaluator",
      description: "Evaluates deterministic business rules against workflow state, producing an auditable decision path explanation.",
      category: "COMPUTE",
      type: ToolType.READ,
      parameters: {
        type: "object",
        properties: {
          field: { type: "string" },
          operator: { type: "string" },
          threshold: {},
          actualValue: {},
        },
        required: ["field", "operator", "threshold", "actualValue"],
      },
      requiresApproval: false,
      isSystem: true,
    },
    {
      name: "final_report",
      displayName: "Final Report Generator",
      description: "Consolidates workflow results, evaluations, and external actions into a structured executive report.",
      category: "TASK",
      type: ToolType.READ,
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          stepResults: { type: "object" },
        },
        required: ["title", "summary"],
      },
      requiresApproval: false,
      isSystem: true,
    },
  ];

  for (const tool of tools) {
    await prisma.toolDefinition.upsert({
      where: { name: tool.name },
      update: tool,
      create: tool,
    });
  }
  console.log(`✅ Seeded ${tools.length} system tool definitions.`);

  // 2. Seed Default User (if SEED_USER_ID or default demo user is specified)
  const seedUserId = process.env.SEED_USER_ID || "user_demo_agent_studio";
  const user = await prisma.user.upsert({
    where: { id: seedUserId },
    update: {},
    create: {
      id: seedUserId,
      email: "demo@agentstudio.io",
      name: "Demo Candidate User",
      role: Role.USER,
    },
  });
  console.log(`✅ Seeded User: ${user.name} (${user.id})`);

  // 3. Seed 1-Click MCP Ecosystem Presets (DISCONNECTED by default — users connect on demand)
  const mcpPresets = [
    {
      name: "GitHub MCP",
      transport: McpTransport.SSE,
      endpointUrl: "https://api.githubcopilot.com/mcp/",
      command: null,
      headers: { Authorization: "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}" },
      description: "GitHub API integration: repositories, issues, pull requests, and code search.",
    },
    {
      name: "Postgres MCP",
      transport: McpTransport.STDIO,
      endpointUrl: null,
      command: "npx -y @modelcontextprotocol/server-postgres <DATABASE_URL>",
      headers: null,
      description: "Read/write access to a PostgreSQL database through the reference Postgres MCP server.",
    },
    {
      name: "SQLite MCP",
      transport: McpTransport.STDIO,
      endpointUrl: null,
      command: "npx -y @modelcontextprotocol/server-sqlite <PATH_TO_DB_FILE>",
      headers: null,
      description: "Local SQLite database access via the reference SQLite MCP server.",
    },
    {
      name: "Web Fetch MCP",
      transport: McpTransport.SSE,
      endpointUrl: "https://mcp.kagi.com/fetch",
      command: null,
      headers: {},
      description: "Fetch and summarize web pages with clean article extraction (Kagi).",
    },
    {
      name: "Brave Search MCP",
      transport: McpTransport.SSE,
      endpointUrl: "https://api.search.brave.com/mcp/server",
      command: null,
      headers: { Authorization: "Bearer ${BRAVE_SEARCH_API_KEY}" },
      description: "Web and news search powered by the Brave Search API.",
    },
    {
      name: "Filesystem MCP",
      transport: McpTransport.STDIO,
      endpointUrl: null,
      command: "npx -y @modelcontextprotocol/server-filesystem <ALLOWED_DIRECTORY>",
      headers: null,
      description: "Read/write access to local files and directories (sandboxed to allowed roots).",
    },
    {
      name: "Slack MCP",
      transport: McpTransport.STDIO,
      endpointUrl: null,
      command: "npx -y @modelcontextprotocol/server-slack",
      headers: null,
      description: "Dispatch notifications, read channel threads, and search messages.",
    },
    {
      name: "Memory MCP",
      transport: McpTransport.STDIO,
      endpointUrl: null,
      command: "npx -y @modelcontextprotocol/server-memory",
      headers: null,
      description: "Persistent knowledge-graph memory across agent executions.",
    },
  ];

  for (const preset of mcpPresets) {
    await prisma.mcpServer.upsert({
      where: { id: `preset-${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` },
      update: {
        userId: user.id,
        name: preset.name,
        transport: preset.transport,
        endpointUrl: preset.endpointUrl,
        command: preset.command,
        headers: (preset.headers ?? Prisma.DbNull) as Prisma.InputJsonValue,
        status: McpServerStatus.DISCONNECTED,
        cachedTools: [],
      },
      create: {
        id: `preset-${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        userId: user.id,
        name: preset.name,
        transport: preset.transport,
        endpointUrl: preset.endpointUrl,
        command: preset.command,
        headers: (preset.headers ?? Prisma.DbNull) as Prisma.InputJsonValue,
        status: McpServerStatus.DISCONNECTED,
        cachedTools: [],
      },
    });
  }
  console.log(`✅ Seeded ${mcpPresets.length} MCP server presets.`);

  // 4. Seed Sample Demo Skill with Versions
  const demoSkillName = "Customer Refund Bounded Workflow";
  let skill = await prisma.skill.findFirst({
    where: { userId: user.id, name: demoSkillName },
  });

  if (!skill) {
    skill = await prisma.skill.create({
      data: {
        userId: user.id,
        name: demoSkillName,
        purpose: "Bounded multi-step workflow: retrieves customer policy, extracts refund parameters, evaluates deterministic rules, requests human approval for disbursements, and generates a final audit report.",
        status: SkillStatus.PUBLISHED,
        versions: {
          create: [
            {
              versionNumber: 1,
              status: SkillStatus.PUBLISHED,
              instructions: "Execute bounded refund validation: 1. Extract refund amount and reason. 2. Evaluate if amount > $500. 3. If high value, request manager approval. 4. Generate final report.",
              inputSchema: {
                type: "object",
                properties: {
                  customerName: { type: "string" },
                  requestText: { type: "string" },
                },
                required: ["customerName", "requestText"],
              },
              outputSchema: {
                type: "object",
                properties: {
                  report: { type: "object" },
                  status: { type: "string" },
                },
              },
              examples: [
                {
                  input: {
                    customerName: "Alice Smith",
                    requestText: "Customer requested a $750.00 refund due to shipping damage on order #8812",
                  },
                  output: { status: "COMPLETED" },
                },
              ],
              allowedTools: [
                "ai_extraction",
                "ai_classification",
                "deterministic_condition",
                "mock_task_creator",
                "final_report",
              ],
              actionsRequiringApproval: ["create_task"],
              maxExecutionSteps: 10,
              changelog: "v1: Bounded workflow automation with deterministic rule explainer & HITL safety gate",
            },
          ],
        },
      },
    });
    console.log(`✅ Seeded Demo Workflow: ${skill.name}`);
  }


  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
