import { PrismaClient, Role, SkillStatus, ToolType, ExecutionStatus } from "@prisma/client";

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

  // 3. Seed Sample Demo Skill with Versions
  const demoSkillName = "Financial & Tax Calculator";
  let skill = await prisma.skill.findFirst({
    where: { userId: user.id, name: demoSkillName },
  });

  if (!skill) {
    skill = await prisma.skill.create({
      data: {
        userId: user.id,
        name: demoSkillName,
        purpose: "Calculates invoice subtotal, tax rates, and discount deductions using math tools.",
        status: SkillStatus.PUBLISHED,
        versions: {
          create: [
            {
              versionNumber: 1,
              status: SkillStatus.PUBLISHED,
              instructions: "Evaluate the given expression and apply tax calculations accurately.",
              inputSchema: {
                type: "object",
                properties: {
                  expression: { type: "string" },
                },
                required: ["expression"],
              },
              outputSchema: {
                type: "object",
                properties: {
                  result: { type: "number" },
                },
              },
              examples: [
                { input: { expression: "450 * 1.18" }, output: { result: 531 } },
              ],
              allowedTools: ["calculator"],
              actionsRequiringApproval: [],
              maxExecutionSteps: 10,
              changelog: "Initial published version v1",
            },
          ],
        },
      },
    });
    console.log(`✅ Seeded Demo Skill: ${skill.name}`);
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
