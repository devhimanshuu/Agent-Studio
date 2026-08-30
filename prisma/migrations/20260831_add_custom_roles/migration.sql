-- CreateTable
CREATE TABLE "custom_roles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_roles_organizationId_name_key" ON "custom_roles"("organizationId", "name");

-- CreateIndex
CREATE INDEX "custom_roles_organizationId_idx" ON "custom_roles"("organizationId");

-- Add foreign key
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add customRoleId to organization_members
ALTER TABLE "organization_members" ADD COLUMN "customRoleId" TEXT;

-- Add foreign key for customRoleId
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default system roles for existing organizations
INSERT INTO "custom_roles" ("id", "organizationId", "name", "description", "permissions", "isSystem", "createdAt", "updatedAt")
SELECT 
    'role-owner-' || o.id,
    o.id,
    'Owner',
    'Full control over the organization',
    '["org:manage", "members:manage", "skills:create", "skills:edit", "skills:delete", "skills:execute", "executions:view", "executions:create", "mcp:manage", "vault:manage", "audit:view", "api_keys:manage", "roles:manage"]',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o;

INSERT INTO "custom_roles" ("id", "organizationId", "name", "description", "permissions", "isSystem", "createdAt", "updatedAt")
SELECT 
    'role-admin-' || o.id,
    o.id,
    'Admin',
    'Can manage members and all resources',
    '["members:manage", "skills:create", "skills:edit", "skills:delete", "skills:execute", "executions:view", "executions:create", "mcp:manage", "vault:manage", "audit:view", "api_keys:manage"]',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o;

INSERT INTO "custom_roles" ("id", "organizationId", "name", "description", "permissions", "isSystem", "createdAt", "updatedAt")
SELECT 
    'role-member-' || o.id,
    o.id,
    'Member',
    'Can create and edit own resources',
    '["skills:create", "skills:edit:own", "skills:execute", "executions:view:own", "executions:create", "mcp:read", "vault:create", "vault:read:own"]',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o;

INSERT INTO "custom_roles" ("id", "organizationId", "name", "description", "permissions", "isSystem", "createdAt", "updatedAt")
SELECT 
    'role-viewer-' || o.id,
    o.id,
    'Viewer',
    'Read-only access to all resources',
    '["skills:read", "executions:read", "mcp:read", "vault:read", "audit:read"]',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o;
