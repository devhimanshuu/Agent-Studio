import { describe, it, expect } from "vitest";
import {
  parseJsonRpcMessage,
  isJsonRpcError,
  mapToolsList,
  normalizeToolDefinition,
  normalizeInputSchema,
  isWriteByHeuristic,
  normalizeToolResult,
  extractTextContent,
} from "@/modules/mcp/protocol";

describe("parseJsonRpcMessage", () => {
  it("parses a valid JSON-RPC 2.0 request string", () => {
    const message = parseJsonRpcMessage('{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}');
    expect(message).not.toBeNull();
    expect(message!.jsonrpc).toBe("2.0");
    expect(message!.method).toBe("tools/list");
    expect(message!.id).toBe(1);
  });

  it("parses an object payload with a result", () => {
    const message = parseJsonRpcMessage({ jsonrpc: "2.0", id: 2, result: { tools: [] } });
    expect(message!.result).toEqual({ tools: [] });
  });

  it("rejects malformed payloads", () => {
    expect(parseJsonRpcMessage("not json")).toBeNull();
    expect(parseJsonRpcMessage('{"id":1}')).toBeNull(); // missing jsonrpc
    expect(parseJsonRpcMessage('{"jsonrpc":"1.0"}')).toBeNull(); // wrong version
    expect(parseJsonRpcMessage(42)).toBeNull();
    expect(parseJsonRpcMessage(null)).toBeNull();
    expect(parseJsonRpcMessage("[1,2]")).toBeNull();
  });

  it("detects error responses", () => {
    expect(isJsonRpcError(parseJsonRpcMessage('{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}'))).toBe(true);
    expect(isJsonRpcError(parseJsonRpcMessage('{"jsonrpc":"2.0","id":1,"result":{}}'))).toBe(false);
    expect(isJsonRpcError(parseJsonRpcMessage("garbage"))).toBe(true);
  });
});

describe("mapToolsList", () => {
  it("maps a tools/list result into normalized definitions", () => {
    const result = {
      tools: [
        {
          name: "create_issue",
          description: "Create a GitHub issue",
          inputSchema: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
          },
          annotations: { readOnlyHint: false, destructiveHint: true },
        },
        {
          name: "search_code",
          inputSchema: { type: "object", properties: { query: { type: "string" } } },
        },
      ],
    };

    const tools = mapToolsList(result);
    expect(tools).toHaveLength(2);

    // Write detection: destructiveHint → WRITE → requiresApproval.
    expect(tools[0].name).toBe("create_issue");
    expect(tools[0].isWrite).toBe(true);
    expect(tools[0].requiresApproval).toBe(true);

    // No annotations → falls back to the name heuristic.
    expect(tools[1].name).toBe("search_code");
    expect(tools[1].isWrite).toBe(false);
    expect(tools[1].requiresApproval).toBe(false);
    expect(tools[1].description).toBeUndefined();
  });

  it("readOnlyHint overrides the name heuristic", () => {
    const tool = normalizeToolDefinition({
      name: "delete_everything",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
    });
    expect(tool!.isWrite).toBe(false);
    expect(tool!.requiresApproval).toBe(false);
  });

  it("drops malformed entries (missing name / non-object schema)", () => {
    const tools = mapToolsList({
      tools: [
        { description: "no name" },
        { name: "bad_schema", inputSchema: "not-an-object" },
        { name: "good", inputSchema: { type: "object", properties: { a: { type: "string" } } } },
      ],
    });
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("good");
  });

  it("normalizes schemas that are missing or non-object into an object schema", () => {
    expect(normalizeInputSchema(undefined)).toEqual({ type: "object", properties: {} });
    expect(normalizeInputSchema({ type: "string" })).toEqual({
      type: "object",
      properties: { value: { type: "string" } },
    });
    const normalized = normalizeInputSchema({
      type: "object",
      properties: { a: { type: "number" } },
      required: ["a"],
    });
    expect(normalized).not.toBeNull();
    expect(normalized!.required).toEqual(["a"]);
  });
});

describe("isWriteByHeuristic", () => {
  it("flags mutation verbs", () => {
    expect(isWriteByHeuristic("create_issue")).toBe(true);
    expect(isWriteByHeuristic("update_issue")).toBe(true);
    expect(isWriteByHeuristic("delete_record")).toBe(true);
    expect(isWriteByHeuristic("send_email")).toBe(true);
    expect(isWriteByHeuristic("post_message")).toBe(true);
    expect(isWriteByHeuristic("write_file")).toBe(true);
  });

  it("leaves read verbs alone", () => {
    expect(isWriteByHeuristic("search_code")).toBe(false);
    expect(isWriteByHeuristic("get_issue")).toBe(false);
    expect(isWriteByHeuristic("list_repos")).toBe(false);
    expect(isWriteByHeuristic("read_file")).toBe(false);
  });
});

describe("normalizeToolResult", () => {
  it("prefers structuredContent", () => {
    const result = {
      content: [{ type: "text", text: "ignored" }],
      structuredContent: { repo: "agent-studio", stars: 42 },
    };
    expect(normalizeToolResult(result)).toEqual({ repo: "agent-studio", stars: 42 });
  });

  it("joins text blocks when no structuredContent", () => {
    const result = {
      content: [
        { type: "text", text: "line one" },
        { type: "text", text: "line two" },
      ],
    };
    expect(normalizeToolResult(result)).toBe("line one\nline two");
  });

  it("unwraps a JSON blob returned as text", () => {
    const result = { content: [{ type: "text", text: '{"ok":true,"count":3}' }] };
    expect(normalizeToolResult(result)).toEqual({ ok: true, count: 3 });
  });

  it("returns the raw value for scalars and null", () => {
    expect(normalizeToolResult(null)).toBeNull();
    expect(normalizeToolResult(42)).toBe(42);
    expect(normalizeToolResult("plain text")).toBe("plain text");
  });
});

describe("extractTextContent", () => {
  it("extracts text and resource blocks", () => {
    const content = [
      { type: "text", text: "hello" },
      { type: "resource", resource: { text: "world" } },
      { type: "image", data: "abc" },
    ];
    expect(extractTextContent(content)).toBe("hello\nworld");
  });

  it("returns empty string for non-array content", () => {
    expect(extractTextContent("nope")).toBe("");
    expect(extractTextContent(undefined)).toBe("");
  });
});
