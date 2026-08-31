import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  try {
    // Simulate what listMembers does
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: "cmtgbgg5f0000uz7gs4lpvm9k" },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });

    const result = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name,
      userEmail: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    console.log("API Response would be:");
    console.log(JSON.stringify(result, null, 2));
    
    // Check what the component would display
    result.forEach((member) => {
      console.log("\n--- Display Check ---");
      console.log("Avatar letter:", member.userName?.[0] || member.userEmail[0].toUpperCase());
      console.log("Name line:", member.userName || member.userEmail);
      console.log("Email line:", member.userEmail);
    });
  } catch (err: any) {
    console.error("ERROR:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
