/**
 * OpenAPI 3.0.3 specification for Agent Studio.
 *
 * This is the single source of truth for API documentation.
 * Served at GET /api/docs as JSON, rendered by Swagger UI at /docs.
 *
 * When adding new endpoints, add their documentation here.
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Agent Studio API",
    version: "1.0.0",
    description:
      "Enterprise AI Agent Platform API. Create, test, version, and execute reusable AI skills safely.\n\n" +
      "## Authentication\n" +
      "All endpoints require Clerk authentication via session token, except `/api/health` and MCP SSE endpoints.\n\n" +
      "## Organization Context\n" +
      "Pass `X-Organization-Id` header to scope requests to an organization.\n\n" +
      "## Rate Limiting\n" +
      "API requests are rate-limited per client. Exceeding the limit returns 429 with `Retry-After` header.",
    contact: { name: "Agent Studio Team" },
    license: { name: "MIT" },
  },
  servers: [
    { url: "http://localhost:3000", description: "Local development" },
    { url: "https://agent-studio-v1.vercel.app", description: "Production" },
  ],
  tags: [
    { name: "Skills", description: "CRUD operations for AI skills" },
    { name: "Executions", description: "Start, monitor, and control skill executions" },
    { name: "MCP", description: "Model Context Protocol server management" },
    { name: "Organizations", description: "Multi-tenant organization management" },
    { name: "Vault", description: "Encrypted secret storage" },
    { name: "Approvals", description: "Human-in-the-loop approval workflow" },
    { name: "System", description: "Health checks and system status" },
  ],
  components: {
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string" },
          code: { type: "string" },
          fields: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
        },
      },
      Skill: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          name: { type: "string", example: "Sentiment Analyzer" },
          purpose: { type: "string", example: "Analyzes the sentiment of text input" },
          status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
          organizationId: { type: "string", nullable: true },
          currentDraftId: { type: "string", nullable: true },
          publishedVersionId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          versions: { type: "array", items: { "$ref": "#/components/schemas/SkillVersion" } },
        },
      },
      SkillVersion: {
        type: "object",
        properties: {
          id: { type: "string" },
          skillId: { type: "string" },
          versionNumber: { type: "integer" },
          status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          instructions: { type: "string" },
          examples: { type: "array", items: { "$ref": "#/components/schemas/SkillExample" } },
          allowedTools: { type: "array", items: { type: "string" } },
          actionsRequiringApproval: { type: "array", items: { type: "string" } },
          approvalPolicy: { "$ref": "#/components/schemas/ApprovalPolicy" },
          maxExecutionSteps: { type: "integer" },
          graphDefinition: { type: "object", nullable: true },
          changelog: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          publishedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      SkillExample: {
        type: "object",
        properties: {
          input: { type: "object" },
          output: { type: "object" },
          description: { type: "string", maxLength: 300 },
        },
      },
      ApprovalPolicy: {
        type: "object",
        properties: {
          alwaysRequireApproval: { type: "boolean" },
          neverRequireApproval: { type: "boolean" },
          toolBasedApproval: { type: "array", items: { type: "string" } },
          skillBasedApproval: { type: "array", items: { type: "string" } },
        },
      },
      Execution: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          skillVersionId: { type: "string" },
          status: { type: "string", enum: ["PENDING", "RUNNING", "PAUSED_FOR_APPROVAL", "COMPLETED", "FAILED", "CANCELLED", "STEP_LIMIT_EXCEEDED"] },
          inputData: { type: "object" },
          finalOutput: { type: "object", nullable: true },
          plannerOutput: { type: "object", nullable: true },
          provider: { type: "string", nullable: true },
          durationMs: { type: "integer", nullable: true },
          stepCount: { type: "integer" },
          maxSteps: { type: "integer" },
          errorMessage: { type: "string", nullable: true },
          startedAt: { type: "string", format: "date-time" },
          completedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      McpServer: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          transport: { type: "string", enum: ["SSE", "STDIO"] },
          endpointUrl: { type: "string", nullable: true },
          command: { type: "string", nullable: true },
          status: { type: "string", enum: ["CONNECTED", "DISCONNECTED", "ERROR"] },
          cachedTools: { type: "array", items: { type: "object" } },
          organizationId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Organization: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          plan: { type: "string" },
          billingEmail: { type: "string", nullable: true },
          memberCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      VaultEntry: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string", enum: ["API_KEY", "OAUTH_TOKEN", "DATABASE_URL", "CONNECTION_STRING", "PASSWORD", "CERTIFICATE", "WEBHOOK_SECRET", "OTHER"] },
          key: { type: "string" },
          value: { type: "string", description: "Masked value" },
          description: { type: "string", nullable: true },
          tags: { type: "array", items: { type: "string" } },
          lastUsedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
    securitySchemes: {
      clerkSession: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: "Clerk session token (Bearer <token>)",
      },
    },
  },
  security: [{ clerkSession: [] }],
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        description: "Returns service health status. No authentication required.",
        security: [],
        responses: { "200": { description: "Healthy" } },
      },
    },
    "/api/skills": {
      get: {
        tags: ["Skills"],
        summary: "List skills",
        description: "List skills for the authenticated user. Pass X-Organization-Id header to scope to an organization.",
        parameters: [
          { name: "search", in: "query", schema: { type: "string", maxLength: 100 }, required: false },
          { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }, required: false },
          { name: "sortBy", in: "query", schema: { type: "string", enum: ["updatedAt", "name", "createdAt"] }, required: false },
          { name: "sortOrder", in: "query", schema: { type: "string", enum: ["asc", "desc"] }, required: false },
          { name: "organizationId", in: "query", schema: { type: "string", format: "uuid" }, required: false },
        ],
        responses: {
          "200": {
            description: "Skills retrieved",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        items: { type: "array", items: { "$ref": "#/components/schemas/Skill" } },
                        total: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Authentication required", content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
        },
      },
      post: {
        tags: ["Skills"],
        summary: "Create a skill",
        description: "Create a new skill. Pass X-Organization-Id header for org-scoped creation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "purpose", "allowedTools"],
                properties: {
                  name: { type: "string", minLength: 2, maxLength: 100, example: "Sentiment Analyzer" },
                  purpose: { type: "string", minLength: 5, maxLength: 1000, example: "Analyzes sentiment of text" },
                  instructions: { type: "string", minLength: 5, maxLength: 20000 },
                  allowedTools: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20, example: ["calculator"] },
                  inputSchema: { type: "object" },
                  outputSchema: { type: "object" },
                  examples: { type: "array", items: { "$ref": "#/components/schemas/SkillExample" }, maxItems: 50 },
                  actionsRequiringApproval: { type: "array", items: { type: "string" }, maxItems: 20 },
                  approvalPolicy: { "$ref": "#/components/schemas/ApprovalPolicy" },
                  maxExecutionSteps: { type: "integer", minimum: 1, maximum: 100, example: 10 },
                  graphDefinition: { type: "object", description: "Visual graph workflow definition" },
                  notes: { type: "string", maxLength: 5000 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Skill created", content: { "application/json": { schema: { "$ref": "#/components/schemas/Skill" } } } },
          "400": { description: "Validation error", content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Authentication required" },
        },
      },
    },
    "/api/skills/{id}": {
      get: {
        tags: ["Skills"],
        summary: "Get a skill by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Skill found", content: { "application/json": { schema: { "$ref": "#/components/schemas/Skill" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
        },
      },
      put: {
        tags: ["Skills"],
        summary: "Update a skill draft",
        description: "Update the current draft version of a skill. Supports partial updates.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 2, maxLength: 100 },
                  purpose: { type: "string", minLength: 5, maxLength: 1000 },
                  instructions: { type: "string", minLength: 5, maxLength: 20000 },
                  allowedTools: { type: "array", items: { type: "string" }, minItems: 1 },
                  inputSchema: { type: "object" },
                  outputSchema: { type: "object" },
                  maxExecutionSteps: { type: "integer", minimum: 1, maximum: 100 },
                  graphDefinition: { type: "object", nullable: true },
                  notes: { type: "string", maxLength: 5000 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Skill draft updated", content: { "application/json": { schema: { "$ref": "#/components/schemas/SkillVersion" } } } },
          "400": { description: "Validation error" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["Skills"],
        summary: "Delete a draft skill",
        description: "Delete a skill that is still in DRAFT status. Published skills cannot be deleted — archive them instead.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Skill deleted" },
          "400": { description: "Cannot delete published skill" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/skills/{id}/publish": {
      post: {
        tags: ["Skills"],
        summary: "Publish a skill version",
        description: "Publish a draft version, making it the active published version.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["versionId"],
                properties: { versionId: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Version published", content: { "application/json": { schema: { "$ref": "#/components/schemas/SkillVersion" } } } },
          "400": { description: "Only draft versions can be published" },
        },
      },
    },
    "/api/skills/{id}/archive": {
      post: {
        tags: ["Skills"],
        summary: "Archive a skill",
        description: "Archive a skill, preventing further edits. Archived skills can be duplicated.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Skill archived" } },
      },
    },
    "/api/skills/{id}/duplicate": {
      post: {
        tags: ["Skills"],
        summary: "Duplicate a skill",
        description: "Create a copy of an existing skill as a new draft.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "201": { description: "Skill duplicated", content: { "application/json": { schema: { "$ref": "#/components/schemas/Skill" } } } },
        },
      },
    },
    "/api/executions": {
      get: {
        tags: ["Executions"],
        summary: "List executions",
        responses: {
          "200": {
            description: "Executions listed",
            content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/Execution" } } } },
          },
        },
      },
      post: {
        tags: ["Executions"],
        summary: "Start an execution",
        description: "Start executing a skill version with the given input data.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["skillVersionId", "inputData"],
                properties: {
                  skillVersionId: { type: "string" },
                  inputData: { type: "object", example: { text: "Hello world" } },
                  organizationId: { type: "string" },
                  replayOutputs: { type: "object", description: "Replay outputs for resuming from a checkpoint" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Execution started", content: { "application/json": { schema: { "$ref": "#/components/schemas/Execution" } } } },
          "400": { description: "Invalid input or skill validation failed" },
        },
      },
    },
    "/api/executions/{id}": {
      get: {
        tags: ["Executions"],
        summary: "Get execution details",
        description: "Get detailed information about a specific execution including steps and tool calls.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Execution found", content: { "application/json": { schema: { "$ref": "#/components/schemas/Execution" } } } },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/executions/{id}/cancel": {
      post: {
        tags: ["Executions"],
        summary: "Cancel a running execution",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Execution cancelled" } },
      },
    },
    "/api/executions/{id}/resume": {
      post: {
        tags: ["Executions"],
        summary: "Resume a paused execution",
        description: "Resume an execution that was paused for approval or other reasons.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Execution resumed" } },
      },
    },
    "/api/executions/{id}/retry": {
      post: {
        tags: ["Executions"],
        summary: "Retry a failed execution",
        description: "Retry a failed execution, replaying completed steps from the persisted trace.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Execution retried" } },
      },
    },
    "/api/mcp/servers": {
      get: {
        tags: ["MCP"],
        summary: "List MCP servers",
        responses: { "200": { description: "MCP servers listed", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/McpServer" } } } } } },
      },
      post: {
        tags: ["MCP"],
        summary: "Create an MCP server",
        description: "Register a new Model Context Protocol server for tool discovery.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "transport"],
                properties: {
                  name: { type: "string", minLength: 2, maxLength: 100, example: "My MCP Server" },
                  transport: { type: "string", enum: ["SSE", "STDIO"] },
                  endpointUrl: { type: "string", format: "uri", description: "Required for SSE transport" },
                  command: { type: "string", minLength: 3, maxLength: 500, description: "Required for STDIO transport", example: "npx -y @modelcontextprotocol/server-filesystem" },
                  headers: { type: "object", additionalProperties: { type: "string" }, description: "Custom HTTP headers (SSE only)", maxLength: 20 },
                  connectOnCreate: { type: "boolean", description: "Auto-connect after creation" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "MCP server created" },
          "400": { description: "Validation error" },
        },
      },
    },
    "/api/organizations": {
      get: {
        tags: ["Organizations"],
        summary: "List user's organizations",
        responses: { "200": { description: "Organizations listed", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/Organization" } } } } } },
      },
      post: {
        tags: ["Organizations"],
        summary: "Create an organization",
        description: "Create a new organization. The creator becomes the OWNER.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", minLength: 2, maxLength: 100, example: "Acme Corp" },
                  slug: { type: "string", description: "Auto-generated from name if omitted" },
                  plan: { type: "string", default: "enterprise" },
                  billingEmail: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Organization created" },
          "400": { description: "Slug already exists" },
        },
      },
    },
    "/api/vault": {
      get: {
        tags: ["Vault"],
        summary: "List vault entries",
        description: "List all vault entries for the authenticated user. Values are masked for security.",
        responses: { "200": { description: "Vault entries listed", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/VaultEntry" } } } } } },
      },
      post: {
        tags: ["Vault"],
        summary: "Create a vault entry",
        description: "Store an encrypted secret in the vault. Values are AES-256-GCM encrypted at rest.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "key", "value"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 100, example: "OpenAI API Key" },
                  category: { type: "string", enum: ["API_KEY", "OAUTH_TOKEN", "DATABASE_URL", "CONNECTION_STRING", "PASSWORD", "CERTIFICATE", "WEBHOOK_SECRET", "OTHER"], default: "API_KEY" },
                  key: { type: "string", minLength: 1, maxLength: 200, example: "OPENAI_API_KEY" },
                  value: { type: "string", minLength: 1, description: "The secret value (encrypted at rest)" },
                  description: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Vault entry created" },
          "400": { description: "Duplicate key" },
        },
      },
    },
    "/api/approvals": {
      get: {
        tags: ["Approvals"],
        summary: "List pending approvals",
        description: "List approval requests awaiting human review.",
        responses: { "200": { description: "Approvals listed" } },
      },
    },
    "/api/approvals/{id}/approve": {
      post: {
        tags: ["Approvals"],
        summary: "Approve a request",
        description: "Approve a pending approval request, allowing the execution to continue.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Approval granted" } },
      },
    },
    "/api/approvals/{id}/reject": {
      post: {
        tags: ["Approvals"],
        summary: "Reject a request",
        description: "Reject a pending approval request, cancelling the associated execution.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { reason: { type: "string", description: "Rejection reason shown to the user" } },
              },
            },
          },
        },
        responses: { "200": { description: "Approval rejected" } },
      },
    },
  },
} as const;
