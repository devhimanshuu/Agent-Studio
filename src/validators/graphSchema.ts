import { z } from "zod";

/**
 * Zod validation for the visual agent graph definition. Mirrors
 * src/types/graph.ts so untrusted API payloads are validated before they can
 * reach the database or the graph interpreter.
 */

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const graphNodeDataSchema = z.object({
  label: z.string().min(1, "Node label is required").max(120),
  description: z.string().max(1000).optional(),
  prompt: z.string().max(10000).optional(),
  allowedTools: z.array(z.string().min(1)).max(50).optional(),
  toolName: z.string().max(120).optional(),
  action: z.string().max(120).optional(),
  inputTemplate: z.record(z.string(), z.unknown()).optional(),
  routerMode: z.enum(["deterministic", "ai"]).optional(),
  condition: z.string().max(1000).optional(),
  routerPrompt: z.string().max(4000).optional(),
  approvalReason: z.string().max(2000).optional(),
  autoApproveCondition: z.string().max(1000).optional(),
  escalateAfterMin: z.number().int().min(1).max(10080).optional(),
  maxIterations: z.number().int().min(1).max(100).optional(),
  parallelMode: z.enum(["map", "reduce"]).optional(),
  mapField: z.string().max(500).optional(),
  subgraph: z.any().optional(),
  inputMapping: z.record(z.string()).optional(),
  outputMapping: z.record(z.string()).optional(),
  mcpServerId: z.string().max(120).optional(),
  mcpTransport: z.enum(["STDIO", "SSE"]).optional(),
  mcpEndpoint: z.string().max(1000).optional(),
  mcpToolName: z.string().max(120).optional(),
  mcpToolServer: z.string().max(120).optional(),
  mcpToolParams: z.record(z.string(), z.unknown()).optional(),
  skillId: z.string().max(120).optional(),
  skillInput: z.record(z.string(), z.unknown()).optional(),
  httpMethod: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  httpUrl: z.string().max(2000).optional(),
  httpHeaders: z.record(z.string(), z.string()).optional(),
  httpBody: z.record(z.string(), z.unknown()).optional(),
  httpResponseType: z.enum(["json", "text", "blob"]).optional(),
  httpTimeoutMs: z.number().int().positive().optional(),
  transformOp: z.string().max(50).optional(),
  transformExpr: z.string().max(4000).optional(),
  delayMs: z.number().int().nonnegative().optional(),
  delayTemplate: z.string().max(500).optional(),
  aggregateMode: z.string().max(50).optional(),
  aggregateExpr: z.string().max(4000).optional(),
  varName: z.string().max(120).optional(),
  varOp: z.string().max(50).optional(),
  varValue: z.unknown().optional(),
  outputTemplate: z.string().max(4000).optional(),
  outputFields: z.record(z.string(), z.string()).optional(),
  noteContent: z.string().max(10000).optional(),
  noteColor: z.string().max(50).optional(),
  frameTitle: z.string().max(120).optional(),
  frameOpacity: z.number().min(0).max(1).optional(),
  containedNodeIds: z.array(z.string()).optional(),
});

export const graphNodeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum([
    "start",
    "end",
    "agent",
    "supervisor",
    "tool",
    "router",
    "approval",
    "loop",
    "parallel",
    "subgraph",
    "mcp_server",
    "mcp_tool",
    "skill",
    "http",
    "transform",
    "delay",
    "aggregate",
    "variable",
    "output",
    "sticky_note",
    "frame",
  ]),
  position: positionSchema,
  data: graphNodeDataSchema,
});

export const graphEdgeSchema = z.object({
  id: z.string().min(1).max(100),
  source: z.string().min(1).max(100),
  target: z.string().min(1).max(100),
  label: z.string().max(120).optional(),
});

export const graphDefinitionSchema = z
  .object({
    version: z.literal(1),
    nodes: z.array(graphNodeSchema).min(1, "Graph must contain at least one node"),
    edges: z.array(graphEdgeSchema),
  })
  .refine((g) => g.nodes.some((n) => n.type === "start"), {
    message: "Graph must contain a START node",
  })
  .refine((g) => g.nodes.some((n) => n.type === "end"), {
    message: "Graph must contain an END node",
  })
  .refine(
    (g) => {
      const ids = new Set(g.nodes.map((n) => n.id));
      return g.edges.every((e) => ids.has(e.source) && ids.has(e.target));
    },
    { message: "Edges must reference existing node ids" }
  );
