import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createOpenApiTool,
  executeOpenApiRequest,
  openApiToolRegistryName,
} from "@/modules/openapi/dynamicTool";
import { OpenApiEndpointDefinition } from "@/types/openapi";

describe("Dynamic OpenAPI Tool", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const sampleEndpoint: OpenApiEndpointDefinition = {
    id: "ep_user",
    operationId: "getUser",
    method: "GET",
    path: "/users/{id}",
    summary: "Get User",
    description: "Fetch user by id",
    tags: ["Users"],
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      {
        name: "includeOrders",
        in: "query",
        required: false,
        schema: { type: "boolean" },
      },
    ],
    isWrite: false,
    requiresApproval: false,
    enabled: true,
  };

  it("generates deterministic registry-safe names", () => {
    const name = openApiToolRegistryName("stripe_api", "create_payment_intent");
    expect(name).toBe("openapi_stripe_api_create_payment_intent");
  });

  it("creates a tool conforming to the Tool interface", () => {
    const tool = createOpenApiTool(sampleEndpoint, {
      integrationId: "int_1",
      integrationName: "User Service",
      baseUrl: "https://api.users.com",
      authType: "NONE",
    });

    expect(tool.id).toBe("openapi_int_1_getuser");
    expect(tool.name).toBe("openapi_int_1_getuser");
    expect(tool.displayName).toBe("Get User");
    expect(tool.type).toBe("READ");
    expect(tool.requiresApproval).toBe(false);
    expect(tool.validate({ id: "123" })).toEqual([]);
    expect(tool.validate({})).toHaveLength(1);
  });

  it("interpolates path parameters, query parameters, and injects Bearer auth header", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "42", name: "Alice" }),
    });

    const result = await executeOpenApiRequest(
      sampleEndpoint,
      {
        integrationId: "int_1",
        integrationName: "User Service",
        baseUrl: "https://api.users.com",
        authType: "BEARER",
        authConfig: { bearerToken: "secret_token_123" },
      },
      { id: "42", includeOrders: true }
    );

    expect(result.status).toBe("SUCCESS");
    expect(result.data).toEqual({ id: "42", name: "Alice" });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.users.com/users/42?includeOrders=true",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer secret_token_123",
        }),
      })
    );
  });

  it("handles API_KEY auth in custom header", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ status: "ok" }),
    });

    await executeOpenApiRequest(
      sampleEndpoint,
      {
        integrationId: "int_1",
        integrationName: "User Service",
        baseUrl: "https://api.users.com",
        authType: "API_KEY",
        authConfig: { apiKeyHeader: "X-API-KEY", apiKeyValue: "key_abc_123" },
      },
      { id: "99" }
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.users.com/users/99",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-KEY": "key_abc_123",
        }),
      })
    );
  });
});
