import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  try {
    console.log("Testing organization create...");
    const org = await prisma.organization.create({
      data: {
        name: "Test Org",
        slug: `test-org-${Date.now()}`,
        plan: "free",
        members: {
          create: {
            userId: "cmtgbains0000uz7g0vagjlyz",
            role: "OWNER",
            permissions: [],
          },
        },
      },
      include: { _count: { select: { members: true } } },
    });
    console.log("SUCCESS:", org.id, org.name);

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
    console.log("Cleaned up");
  } catch (err: any) {
    console.error("ERROR:", err.message);
    console.error("STACK:", err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();
