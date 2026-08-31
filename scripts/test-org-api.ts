import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  try {
    const userId = "cmtgbains0000uz7g0vagjlyz";

    console.log("1. Testing OrganizationService import...");
    const { OrganizationService } = await import("@/services/OrganizationService");
    console.log("   ✅ Import OK");

    console.log("2. Instantiating service...");
    const svc = new OrganizationService();
    console.log("   ✅ Instantiation OK");

    console.log("3. Listing user organizations...");
    const orgs = await svc.listUserOrganizations(userId);
    console.log("   ✅ Found", orgs.length, "organizations");
    orgs.forEach(o => console.log("   -", o.name, `(${o.id})`, `[${o.plan}]`));

    console.log("4. Getting org by ID...");
    if (orgs.length > 0) {
      const org = await svc.getById(userId, orgs[0].id);
      console.log("   ✅ Got org:", org?.name);
    }

    console.log("5. Testing create...");
    const newOrg = await svc.create(userId, {
      name: "Test Create Org",
    });
    console.log("   ✅ Created:", newOrg.name, `(${newOrg.id})`);

    // Cleanup
    console.log("6. Cleaning up...");
    await prisma.organization.delete({ where: { id: newOrg.id } });
    console.log("   ✅ Cleaned up");

    console.log("\n🎉 All tests passed!");
  } catch (err: any) {
    console.error("\n❌ ERROR:", err.message);
    console.error("STACK:", err.stack?.split("\n").slice(0, 15).join("\n"));
  } finally {
    await prisma.$disconnect();
  }
}

test();
