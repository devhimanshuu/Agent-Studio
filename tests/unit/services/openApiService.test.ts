import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenApiService } from "@/services/OpenApiService";
import { IOpenApiRepository } from "@/repositories/interfaces/IOpenApiRepository";
import { OpenApiIntegrationDTO } from "@/types/openapi";
import { ToolRegistry } from "@/modules/tools";

function createMockRepo(): IOpenApiRepository {
  const store = new Map<string, OpenApiIntegrationDTO>();

  return {
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    getRawAuthConfigForUser: vi.fn(async () => null),
    findByIdForUser: vi.fn(async (id: string, userId: string) => {
      const item = store.get(id);
      return item && item.userId === userId ? item : null;
    }),
    findByUserId: vi.fn(async (userId: string) => {
      return [...store.values()].filter((item) => item.userId === userId);
    }),
    create: vi.fn(async (input) => {
      const item: OpenApiIntegrationDTO = {
        id: `int_${Date.now()}`,
        userId: input.userId,
        name: input.name,
        description: input.description ?? null,
        specUrl: input.specUrl ?? null,
        rawSpec: input.rawSpec,
        baseUrl: input.baseUrl,
        authType: input.authType ?? "NONE",
        authConfig: input.authConfig ?? null,
        endpoints: input.endpoints,
        status: "CONNECTED",
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(item.id, item);
      return item;
    }),
    update: vi.fn(async (id, userId, input) => {
      const existing = store.get(id);
      if (!existing || existing.userId !== userId) throw new Error("Not found");
      const updated: OpenApiIntegrationDTO = {
        ...existing,
        ...input,
        updatedAt: new Date(),
      };
      store.set(id, updated);
      return updated;
    }),
    delete: vi.fn(async (id, _userId) => {
      store.delete(id);
    }),
    updateStatus: vi.fn(async (id, status, lastError) => {
      const existing = store.get(id);
      if (!existing) throw new Error("Not found");
      const updated: OpenApiIntegrationDTO = { ...existing, status, lastError: lastError ?? null };
      store.set(id, updated);
      return updated;
    }),
    updateEndpoints: vi.fn(async (id, userId, endpoints) => {
      const existing = store.get(id);
      if (!existing || existing.userId !== userId) throw new Error("Not found");
      const updated: OpenApiIntegrationDTO = { ...existing, endpoints };
      store.set(id, updated);
      return updated;
    }),
  };
}

describe("OpenApiService", () => {
  let service: OpenApiService;
  let repo: IOpenApiRepository;

  beforeEach(() => {
    repo = createMockRepo();
    service = new OpenApiService(repo);
  });

  it("creates integrations and syncs executable tools to ToolRegistry", async () => {
    const integration = await service.createIntegration({
      userId: "usr_100",
      name: "Payments API",
      baseUrl: "https://api.payments.com",
      authType: "BEARER",
      authConfig: { bearerToken: "test_key" },
      rawSpec: {},
      endpoints: [
        {
          id: "ep_charge",
          operationId: "createCharge",
          method: "POST",
          path: "/charges",
          summary: "Create Charge",
          description: "Charge a customer card",
          tags: ["Billing"],
          parameters: [],
          requestBody: {
            required: true,
            schema: {
              type: "object",
              properties: { amount: { type: "integer" } },
              required: ["amount"],
            },
          },
          isWrite: true,
          requiresApproval: true,
          enabled: true,
        },
      ],
    });

    expect(integration.id).toBeDefined();
    expect(integration.name).toBe("Payments API");

    const tools = await service.getExecutableTools("usr_100");
    expect(tools).toHaveLength(1);
    expect(tools[0].type).toBe("WRITE");
    expect(tools[0].requiresApproval).toBe(true);

    const registry = new ToolRegistry();
    const count = await service.syncRegistryTools("usr_100", registry);
    expect(count).toBe(1);
    expect(registry.hasTool(tools[0].name)).toBe(true);
  });
});
