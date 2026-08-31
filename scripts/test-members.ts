import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  try {
    const userId = "cmtgbains0000uz7g0vagjlyz";
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    console.log("User:", user);

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: "cmtgbgg5f0000uz7gs4lpvm9k" },
      include: { user: { select: { name: true, email: true } } },
    });
    console.log(
      "Members:",
      JSON.stringify(
        members.map((m) => ({
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        })),
        null,
        2
      )
    );
  } catch (err: any) {
    console.error("ERROR:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
