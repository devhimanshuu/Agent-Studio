import { describe, it, expect } from "vitest";
import { endpointToInputSchema } from "@/modules/openapi/schemaConverter";
import { OpenApiEndpointDefinition } from "@/types/openapi";

describe("OpenAPI Schema Converter", () => {
  it("converts path and query parameters into JSON Schema and Zod schema", () => {
    const endpoint: OpenApiEndpointDefinition = {
      id: "ep_1",
      operationId: "getUserOrders",
      method: "GET",
      path: "/users/{userId}/orders",
      summary: "Get User Orders",
      description: "List orders for a user",
      tags: ["Orders"],
      parameters: [
        {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["active", "archived"] },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer" },
        },
      ],
      isWrite: false,
      requiresApproval: false,
      enabled: true,
    };

    const { jsonSchema, zodSchema } = endpointToInputSchema(endpoint);

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties).toHaveProperty("userId");
    expect(jsonSchema.properties).toHaveProperty("status");
    expect(jsonSchema.properties).toHaveProperty("limit");
    expect(jsonSchema.required).toEqual(["userId"]);

    // Test valid parsing
    const valid = zodSchema.safeParse({ userId: "usr_123", status: "active", limit: 10 });
    expect(valid.success).toBe(true);

    // Test missing required field
    const missing = zodSchema.safeParse({ status: "active" });
    expect(missing.success).toBe(false);
  });

  it("merges requestBody properties into input schema", () => {
    const endpoint: OpenApiEndpointDefinition = {
      id: "ep_2",
      operationId: "createOrder",
      method: "POST",
      path: "/orders",
      summary: "Create Order",
      description: "Place new order",
      tags: ["Orders"],
      parameters: [],
      requestBody: {
        required: true,
        schema: {
          type: "object",
          properties: {
            item: { type: "string" },
            quantity: { type: "integer" },
          },
          required: ["item", "quantity"],
        },
      },
      isWrite: true,
      requiresApproval: true,
      enabled: true,
    };

    const { jsonSchema, zodSchema } = endpointToInputSchema(endpoint);
    expect(jsonSchema.properties).toHaveProperty("item");
    expect(jsonSchema.properties).toHaveProperty("quantity");
    expect(jsonSchema.required).toEqual(["item", "quantity"]);

    const valid = zodSchema.safeParse({ item: "Book", quantity: 2 });
    expect(valid.success).toBe(true);
  });
});
