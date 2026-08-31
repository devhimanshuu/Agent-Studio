/**
 * Script to set up RBAC test user with enterprise plan
 *
 * Usage: npx tsx scripts/setup-rbac-test-user.ts
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  try {
    const email = "devhimanshuu@gmail.com";

    console.log(`\n🔧 Setting up RBAC test user: ${email}\n`);

    // 1. Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log("📝 Creating new user...");
      user = await prisma.user.create({
        data: {
          email,
          name: "Himanshu",
          role: "USER",
        },
      });
      console.log(`✅ User created: ${user.id}`);
    } else {
      console.log(`✅ User found: ${user.id}`);
    }

    // 2. Create enterprise organization
    const orgSlug = `enterprise-${user.id.slice(0, 8)}`;

    let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });

    if (!org) {
      console.log("🏢 Creating enterprise organization...");
      org = await prisma.organization.create({
        data: {
          name: "Enterprise Workspace",
          slug: orgSlug,
          plan: "enterprise",
          billingEmail: email,
          settings: {
            sso: true,
            auditExport: true,
            customRoles: true,
          },
        },
      });
      console.log(`✅ Organization created: ${org.id}`);
    } else {
      console.log(`✅ Organization found: ${org.id}`);
    }

    // 3. Add user as OWNER
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
    });

    if (!existingMembership) {
      console.log("👤 Adding user as OWNER...");
      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "OWNER",
          permissions: [],
        },
      });
      console.log("✅ User added as OWNER");
    } else {
      console.log("✅ User already a member");
    }

    // 4. Create test custom roles
    const roles = [
      {
        name: "Deployer",
        description: "Can deploy skills to production",
        permissions: ["skills:execute", "skills:publish", "executions:create"],
      },
      {
        name: "Reviewer",
        description: "Can review and approve skills",
        permissions: ["skills:read", "skills:edit", "approval:approve"],
      },
      {
        name: "Auditor",
        description: "Can view audit logs and reports",
        permissions: ["audit:view", "audit:read", "executions:read"],
      },
    ];

    for (const roleData of roles) {
      const existingRole = await prisma.customRole.findFirst({
        where: {
          organizationId: org.id,
          name: roleData.name,
        },
      });

      if (!existingRole) {
        console.log(`🎭 Creating custom role: ${roleData.name}...`);
        await prisma.customRole.create({
          data: {
            organizationId: org.id,
            name: roleData.name,
            description: roleData.description,
            permissions: roleData.permissions,
            isSystem: false,
          },
        });
        console.log(`✅ Role created: ${roleData.name}`);
      } else {
        console.log(`✅ Role exists: ${roleData.name}`);
      }
    }

    // 5. Create API key for testing
    const existingApiKey = await prisma.apiKey.findFirst({
      where: {
        organizationId: org.id,
        name: "Test API Key",
      },
    });

    if (!existingApiKey) {
      console.log("🔑 Creating test API key...");
      const testKey = "as_1_test_rbac_demo_key_123456";
      const keyHash = crypto.createHash("sha256").update(testKey).digest("hex");
      const keyPrefix = testKey.slice(0, 11);

      await prisma.apiKey.create({
        data: {
          organizationId: org.id,
          name: "Test API Key",
          keyHash,
          keyPrefix,
          scopes: ["skills:read", "skills:write", "executions:read", "executions:write"],
          createdBy: user.id,
        },
      });
      console.log(`✅ API key created (prefix: ${keyPrefix})`);
      console.log(`   Full key: ${testKey}`);
    } else {
      console.log("✅ Test API key exists");
    }

    // 6. Print summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 RBAC Test Setup Complete!");
    console.log("=".repeat(60));
    console.log(`
📧 User Email:    ${email}
👤 User ID:       ${user.id}
🏢 Org ID:        ${org.id}
🏷️  Org Slug:     ${org.slug}
💎 Plan:          enterprise

🎭 Custom Roles:  Deployer, Reviewer, Auditor
🔑 API Key:       as_1_test_rbac_demo_key_123456

📋 API Endpoints to Test:
   GET    /api/organizations
   GET    /api/organizations/${org.id}
   GET    /api/organizations/${org.id}/members
   GET    /api/organizations/${org.id}/roles
   GET    /api/organizations/${org.id}/api-keys
   GET    /api/organizations/${org.id}/audit

🔑 Test with API Key:
   Header: X-API-Key: as_1_test_rbac_demo_key_123456

🔑 Test with Organization Context:
   Header: X-Organization-Id: ${org.id}
`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
