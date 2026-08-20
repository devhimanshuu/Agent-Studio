import {
  OpenApiEndpointDefinition,
  OpenApiParameter,
  OpenApiParsedSpecDTO,
  OpenApiRequestBody,
} from "@/types/openapi";

/**
 * Dereference internal $ref pointers within an OpenAPI / Swagger document.
 */
export function dereferenceSchema(
  schema: unknown,
  rootDoc: Record<string, unknown>,
  visited = new Set<string>()
): unknown {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => dereferenceSchema(item, rootDoc, visited));
  }

  const obj = schema as Record<string, unknown>;

  if (typeof obj.$ref === "string") {
    const ref = obj.$ref;
    if (visited.has(ref)) {
      // Avoid circular reference infinite loops
      return { type: "object", description: `[Circular Ref: ${ref}]` };
    }
    visited.add(ref);

    if (ref.startsWith("#/")) {
      const parts = ref.substring(2).split("/");
      let current: unknown = rootDoc;
      for (const part of parts) {
        const decodedPart = decodeURIComponent(part.replace(/~1/g, "/").replace(/~0/g, "~"));
        if (current && typeof current === "object" && decodedPart in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[decodedPart];
        } else {
          current = undefined;
          break;
        }
      }

      if (current !== undefined) {
        const resolved = dereferenceSchema(current, rootDoc, new Set(visited));
        if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
          const { $ref: _, ...rest } = obj;
          return { ...(resolved as Record<string, unknown>), ...rest };
        }
        return resolved;
      }
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = dereferenceSchema(value, rootDoc, visited);
  }
  return result;
}

/**
 * Parse raw spec string (JSON or YAML-like) or object into normalized OpenApiParsedSpecDTO.
 */
export function parseOpenApiSpec(input: string | Record<string, unknown>): OpenApiParsedSpecDTO {
  let doc: Record<string, unknown>;

  if (typeof input === "string") {
    try {
      doc = JSON.parse(input) as Record<string, unknown>;
    } catch {
      // Fallback: try parsing YAML if formatted as YAML
      doc = parseSimpleYamlToJson(input);
    }
  } else {
    doc = input;
  }

  if (!doc || typeof doc !== "object") {
    throw new Error("Invalid OpenAPI specification: Document must be a valid JSON or YAML object");
  }

  // Verify OpenAPI / Swagger version
  const isOpenApi3 = typeof doc.openapi === "string";
  const isSwagger2 = typeof doc.swagger === "string";

  if (!isOpenApi3 && !isSwagger2 && !doc.paths) {
    throw new Error("Invalid specification: Missing 'openapi', 'swagger', or 'paths' property");
  }

  const info = (doc.info as Record<string, unknown>) ?? {};
  const title = typeof info.title === "string" ? info.title : "Imported OpenAPI";
  const version = typeof info.version === "string" ? info.version : "1.0.0";
  const description = typeof info.description === "string" ? info.description : undefined;

  // Extract base URL & servers
  const servers: Array<{ url: string; description?: string }> = [];
  let baseUrl = "";

  if (isOpenApi3 && Array.isArray(doc.servers) && doc.servers.length > 0) {
    for (const server of doc.servers) {
      if (server && typeof server.url === "string") {
        servers.push({
          url: server.url,
          description: typeof server.description === "string" ? server.description : undefined,
        });
      }
    }
    if (servers.length > 0) {
      baseUrl = servers[0].url;
    }
  } else if (isSwagger2) {
    const host = typeof doc.host === "string" ? doc.host : "localhost";
    const basePath = typeof doc.basePath === "string" ? doc.basePath : "";
    const schemes = Array.isArray(doc.schemes) && doc.schemes.length > 0 ? doc.schemes : ["https"];
    const scheme = schemes[0] || "https";
    baseUrl = `${scheme}://${host}${basePath}`.replace(/\/+$/, "");
    servers.push({ url: baseUrl, description: "Default Swagger 2.0 Server" });
  }

  if (!baseUrl) {
    baseUrl = "https://api.example.com";
    servers.push({ url: baseUrl, description: "Default Host" });
  }

  // Normalize paths and endpoints
  const endpoints: OpenApiEndpointDefinition[] = [];
  const pathsObj = (doc.paths as Record<string, unknown>) ?? {};

  const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "head", "options"] as const;

  for (const [pathStr, pathItemRaw] of Object.entries(pathsObj)) {
    if (!pathItemRaw || typeof pathItemRaw !== "object") continue;

    const pathItem = pathItemRaw as Record<string, unknown>;
    const pathLevelParams: OpenApiParameter[] = [];

    // Path level parameters
    if (Array.isArray(pathItem.parameters)) {
      for (const p of pathItem.parameters) {
        const resolvedP = dereferenceSchema(p, doc) as Record<string, unknown>;
        if (resolvedP && typeof resolvedP.name === "string" && typeof resolvedP.in === "string") {
          pathLevelParams.push({
            name: resolvedP.name,
            in: resolvedP.in as OpenApiParameter["in"],
            description: typeof resolvedP.description === "string" ? resolvedP.description : undefined,
            required: resolvedP.required === true || resolvedP.in === "path",
            schema: (resolvedP.schema as Record<string, unknown>) ?? resolvedP,
          });
        }
      }
    }

    for (const method of HTTP_METHODS) {
      const opRaw = pathItem[method];
      if (!opRaw || typeof opRaw !== "object") continue;

      const op = opRaw as Record<string, unknown>;
      const methodUpper = method.toUpperCase() as OpenApiEndpointDefinition["method"];

      const isWriteMethod = ["POST", "PUT", "DELETE", "PATCH"].includes(methodUpper);

      // Operation ID & ID generation
      const operationId =
        typeof op.operationId === "string" && op.operationId.trim()
          ? sanitizeOperationId(op.operationId)
          : generateOperationId(methodUpper, pathStr);

      const summary =
        typeof op.summary === "string" && op.summary.trim()
          ? op.summary.trim()
          : `${methodUpper} ${pathStr}`;

      const opDescription =
        typeof op.description === "string" && op.description.trim()
          ? op.description.trim()
          : summary;

      const tags = Array.isArray(op.tags)
        ? op.tags.filter((t): t is string => typeof t === "string")
        : ["General"];

      // Operation parameters
      const parameters: OpenApiParameter[] = [...pathLevelParams];

      if (Array.isArray(op.parameters)) {
        for (const p of op.parameters) {
          const resolvedP = dereferenceSchema(p, doc) as Record<string, unknown>;
          if (resolvedP && typeof resolvedP.name === "string" && typeof resolvedP.in === "string") {
            const existingIndex = parameters.findIndex(
              (ep) => ep.name === resolvedP.name && ep.in === resolvedP.in
            );
            const paramDef: OpenApiParameter = {
              name: resolvedP.name,
              in: resolvedP.in as OpenApiParameter["in"],
              description: typeof resolvedP.description === "string" ? resolvedP.description : undefined,
              required: resolvedP.required === true || resolvedP.in === "path",
              schema: (resolvedP.schema as Record<string, unknown>) ?? (resolvedP.type ? resolvedP : {}),
            };

            if (existingIndex >= 0) {
              parameters[existingIndex] = paramDef;
            } else {
              parameters.push(paramDef);
            }
          }
        }
      }

      // Request body extraction (OpenAPI 3 vs Swagger 2)
      let requestBody: OpenApiRequestBody | undefined = undefined;

      if (op.requestBody && typeof op.requestBody === "object") {
        const resolvedRb = dereferenceSchema(op.requestBody, doc) as Record<string, unknown>;
        const content = resolvedRb.content as Record<string, unknown> | undefined;

        if (content && typeof content === "object") {
          const jsonContent =
            (content["application/json"] as Record<string, unknown>) ||
            (content["application/x-www-form-urlencoded"] as Record<string, unknown>) ||
            (content["multipart/form-data"] as Record<string, unknown>) ||
            Object.values(content)[0];

          if (jsonContent && typeof jsonContent === "object") {
            requestBody = {
              description: typeof resolvedRb.description === "string" ? resolvedRb.description : undefined,
              required: resolvedRb.required === true,
              contentType: "application/json",
              schema: dereferenceSchema(jsonContent.schema, doc) as Record<string, unknown>,
            };
          }
        }
      } else {
        // Swagger 2.0 body param fallback
        const bodyParam = parameters.find((p) => (p.in as string) === "body");
        if (bodyParam) {
          requestBody = {
            description: bodyParam.description,
            required: bodyParam.required,
            contentType: "application/json",
            schema: dereferenceSchema(bodyParam.schema, doc) as Record<string, unknown>,
          };
          // Remove body param from parameters list since it's converted to requestBody
          const index = parameters.indexOf(bodyParam);
          if (index >= 0) parameters.splice(index, 1);
        }
      }

      // Dereference responses
      const responses = op.responses
        ? (dereferenceSchema(op.responses, doc) as Record<string, unknown>)
        : undefined;

      const endpoint: OpenApiEndpointDefinition = {
        id: `endpoint_${method.toLowerCase()}_${pathStr.replace(/[^a-zA-Z0-9]/g, "_")}`.replace(/_+/g, "_"),
        operationId,
        method: methodUpper,
        path: pathStr,
        summary,
        description: opDescription,
        tags: tags.length > 0 ? tags : ["Default"],
        parameters,
        requestBody,
        responses,
        isWrite: isWriteMethod,
        requiresApproval: isWriteMethod, // HITL required by default for write methods
        enabled: true,
      };

      endpoints.push(endpoint);
    }
  }

  return {
    title,
    version,
    description,
    baseUrl,
    servers,
    endpoints,
    rawSpec: doc,
  };
}

/**
 * Helper to sanitize operation IDs to be valid identifiers.
 */
function sanitizeOperationId(opId: string): string {
  return opId
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/**
 * Generate a descriptive operation ID if one is missing from the spec.
 */
function generateOperationId(method: string, path: string): string {
  const cleanPath = path
    .replace(/\{([^}]+)\}/g, "by_$1")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return `${method.toLowerCase()}_${cleanPath}`;
}

/**
 * Simple lightweight YAML parser for OpenAPI specs when YAML format is pasted.
 */
function parseSimpleYamlToJson(yamlStr: string): Record<string, unknown> {
  const lines = yamlStr.split(/\r?\n/);
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> | unknown[] }> = [
    { indent: -1, obj: root },
  ];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;

    const indent = rawLine.search(/\S/);
    const line = rawLine.trim();

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].obj;

    if (line.includes(":") && !line.startsWith("-")) {
      const colonIndex = line.indexOf(":");
      const key = line.substring(0, colonIndex).trim().replace(/^['"]|['"]$/g, "");
      const valStr = line.substring(colonIndex + 1).trim();

      if (valStr === "" || valStr === "|" || valStr === ">") {
        const newObj: Record<string, unknown> = {};
        if (Array.isArray(current)) {
          current.push({ [key]: newObj });
        } else {
          (current as Record<string, unknown>)[key] = newObj;
        }
        stack.push({ indent, obj: newObj });
      } else {
        let val: unknown = valStr.replace(/^['"]|['"]$/g, "");
        if (valStr === "true") val = true;
        else if (valStr === "false") val = false;
        else if (valStr === "null") val = null;
        else if (!isNaN(Number(valStr)) && valStr !== "") val = Number(valStr);

        if (!Array.isArray(current)) {
          (current as Record<string, unknown>)[key] = val;
        }
      }
    }
  }

  return root;
}
