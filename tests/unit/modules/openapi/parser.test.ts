import { describe, it, expect } from "vitest";
import { parseOpenApiSpec, dereferenceSchema } from "@/modules/openapi/parser";

describe("OpenAPI Parser", () => {
  it("parses an OpenAPI 3.0 spec with internal $ref references", () => {
    const spec = {
      openapi: "3.0.0",
      info: {
        title: "Store API",
        version: "1.0.0",
        description: "A sample store API",
      },
      servers: [{ url: "https://api.store.com/v1" }],
      paths: {
        "/products/{id}": {
          get: {
            operationId: "getProductById",
            summary: "Get single product",
            tags: ["Products"],
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "Success",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Product" },
                  },
                },
              },
            },
          },
          delete: {
            operationId: "deleteProduct",
            summary: "Delete product",
            tags: ["Products"],
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
          },
        },
        "/products": {
          post: {
            operationId: "createProduct",
            summary: "Create product",
            tags: ["Products"],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ProductInput" },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Product: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              price: { type: "number" },
            },
            required: ["id", "name"],
          },
          ProductInput: {
            type: "object",
            properties: {
              name: { type: "string" },
              price: { type: "number" },
            },
            required: ["name", "price"],
          },
        },
      },
    };

    const parsed = parseOpenApiSpec(spec);

    expect(parsed.title).toBe("Store API");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.baseUrl).toBe("https://api.store.com/v1");
    expect(parsed.endpoints).toHaveLength(3);

    // Verify GET endpoint
    const getEp = parsed.endpoints.find((e) => e.method === "GET");
    expect(getEp).toBeDefined();
    expect(getEp?.operationId).toBe("getproductbyid");
    expect(getEp?.isWrite).toBe(false);
    expect(getEp?.requiresApproval).toBe(false);
    expect(getEp?.parameters[0].name).toBe("id");

    // Verify POST endpoint
    const postEp = parsed.endpoints.find((e) => e.method === "POST");
    expect(postEp).toBeDefined();
    expect(postEp?.isWrite).toBe(true);
    expect(postEp?.requiresApproval).toBe(true);
    expect(postEp?.requestBody).toBeDefined();
    expect((postEp?.requestBody?.schema as { properties?: Record<string, unknown> })?.properties?.name).toBeDefined();

    // Verify DELETE endpoint
    const deleteEp = parsed.endpoints.find((e) => e.method === "DELETE");
    expect(deleteEp).toBeDefined();
    expect(deleteEp?.isWrite).toBe(true);
    expect(deleteEp?.requiresApproval).toBe(true);
  });

  it("parses Swagger 2.0 specs and converts body parameters to requestBody", () => {
    const swaggerSpec = {
      swagger: "2.0",
      info: { title: "Pet API", version: "2.0.0" },
      host: "petstore.swagger.io",
      basePath: "/v2",
      schemes: ["https"],
      paths: {
        "/pet": {
          post: {
            operationId: "addPet",
            summary: "Add new pet",
            parameters: [
              {
                name: "body",
                in: "body",
                required: true,
                schema: {
                  type: "object",
                  properties: { name: { type: "string" } },
                },
              },
            ],
          },
        },
      },
    };

    const parsed = parseOpenApiSpec(swaggerSpec);
    expect(parsed.baseUrl).toBe("https://petstore.swagger.io/v2");
    expect(parsed.endpoints).toHaveLength(1);
    expect(parsed.endpoints[0].requestBody).toBeDefined();
    expect(parsed.endpoints[0].parameters).toHaveLength(0);
  });

  it("handles circular $ref gracefully without infinite loops", () => {
    const circularDoc: Record<string, unknown> = {
      components: {
        schemas: {
          Node: {
            type: "object",
            properties: {
              child: { $ref: "#/components/schemas/Node" },
            },
          },
        },
      },
    };

    const resolved = dereferenceSchema(
      { $ref: "#/components/schemas/Node" },
      circularDoc
    ) as Record<string, unknown>;

    expect(resolved).toBeDefined();
    expect(resolved.type).toBe("object");
  });

  it("throws on invalid specification documents", () => {
    expect(() => parseOpenApiSpec("not a json or yaml")).toThrow();
    expect(() => parseOpenApiSpec({ invalid: true })).toThrow();
  });
});
