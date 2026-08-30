import { z } from "zod";
import { OpenApiEndpointDefinition } from "@/types/openapi";
import { jsonSchemaToZod } from "@/modules/mcp/toolAdapter";

interface EndpointSchemas {
  jsonSchema: Record<string, unknown>;
  zodSchema: z.ZodType;
}

/**
 * Converts an OpenApiEndpointDefinition into a unified JSON Schema and Zod validator.
 * Flattens path/query parameters and requestBody fields into a single input structure.
 */
export function endpointToInputSchema(endpoint: OpenApiEndpointDefinition): EndpointSchemas {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  // Process path, query, and header parameters
  for (const param of endpoint.parameters) {
    if (!param.name) continue;

    const paramSchema = param.schema || { type: "string" };
    const schemaWithDesc: Record<string, unknown> = {
      ...paramSchema,
      description: param.description || `Parameter in ${param.in}`,
    };

    properties[param.name] = schemaWithDesc;

    if (param.required || param.in === "path") {
      if (!required.includes(param.name)) {
        required.push(param.name);
      }
    }
  }

  // Process request body if present
  if (endpoint.requestBody?.schema) {
    const rbSchema = endpoint.requestBody.schema;

    // If requestBody is an object with properties, we can merge its properties into the top-level parameters
    // If there is no property collision, otherwise nest under 'body'.
    if (rbSchema.type === "object" && rbSchema.properties && typeof rbSchema.properties === "object") {
      const rbProps = rbSchema.properties as Record<string, unknown>;
      const rbRequired = Array.isArray(rbSchema.required) ? (rbSchema.required as string[]) : [];

      let hasCollision = false;
      for (const key of Object.keys(rbProps)) {
        if (key in properties) {
          hasCollision = true;
          break;
        }
      }

      if (!hasCollision) {
        for (const [key, prop] of Object.entries(rbProps)) {
          properties[key] = prop;
        }
        for (const reqKey of rbRequired) {
          if (!required.includes(reqKey)) {
            required.push(reqKey);
          }
        }
      } else {
        properties["body"] = rbSchema;
        if (endpoint.requestBody.required) {
          required.push("body");
        }
      }
    } else {
      properties["body"] = rbSchema;
      if (endpoint.requestBody.required) {
        required.push("body");
      }
    }
  }

  const jsonSchema: Record<string, unknown> = {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };

  const zodSchema = jsonSchemaToZod(jsonSchema);

  return {
    jsonSchema,
    zodSchema,
  };
}
