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
  description: z.string().max(300).optional(),
  prompt: z.string().max(4000).optional(),
  allowedTools: z.array(z.string().min(1)).max(20).optional(),
  toolName: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  inputTemplate: z.record(z.string(), z.unknown()).optional(),
  routerMode: z.enum(["deterministic", "ai"]).optional(),
  condition: z.string().max(500).optional(),
  routerPrompt: z.string().max(2000).optional(),
  approvalReason: z.string().max(1000).optional(),
  autoApproveCondition: z.string().max(500).optional(),
  escalateAfterMin: z.number().int().min(1).max(10080).optional(),
  maxIterations: z.number().int().min(1).max(100).optional(),
  parallelMode: z.enum(["map", "reduce"]).optional(),
  mapField: z.string().max(300).optional(),
  subgraph: z.any().optional(),
  inputMapping: z.record(z.string()).optional(),
  outputMapping: z.record(z.string()).optional(),
});

export const graphNodeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["start", "end", "agent", "supervisor", "tool", "router", "approval", "loop", "parallel"]),
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
