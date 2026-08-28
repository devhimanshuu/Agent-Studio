import { NextResponse } from "next/server";
import { A2AAgentManifest } from "@/types/a2a";

export const dynamic = "force-dynamic";

/**
 * Google A2A Protocol Manifest Endpoint
 * Conforms to `/.well-known/agent.json` or `/api/a2a/manifest`.
 * Exposes Agent Studio's orchestration engine and skills as an A2A Server.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const manifest: A2AAgentManifest = {
    name: "agent-studio-orchestrator",
    displayName: "Agent Studio Visual A2A Orchestrator",
    description: "Production-grade Visual Multi-Agent Platform & Graph Interpreter supporting Google A2A protocol, LangGraph execution, and Model Context Protocol (MCP).",
    version: "1.0.0",
    protocolVersion: "1.0.0",
    provider: {
      name: "Agent Studio",
      url: origin,
    },
    endpoints: {
      tasks: `${origin}/api/a2a/tasks`,
      messages: `${origin}/api/a2a/messages`,
      stream: `${origin}/api/a2a/tasks?stream=true`,
      health: `${origin}/api/health`,
    },
    capabilities: [
      {
        id: "visual_graph_orchestration",
        name: "Visual Multi-Agent Graph Orchestration",
        description: "Executes complex multi-agent graphs with conditional branching, parallel fan-out, loop refinement, and HITL safety gates.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            context: { type: "object" },
          },
        },
        outputSchema: {
          type: "object",
          properties: {
            results: { type: "object" },
            stepCount: { type: "number" },
          },
        },
        tags: ["orchestration", "multi-agent", "graph", "langgraph"],
      },
      {
        id: "mcp_tool_execution",
        name: "MCP Unified Tool Gateway",
        description: "Executes tools from connected Model Context Protocol (MCP) servers.",
        tags: ["mcp", "tools", "integrations"],
      },
    ],
    auth: {
      type: "none",
    },
    tags: ["visual-orchestration", "multi-agent", "a2a", "mcp"],
    metadata: {
      platform: "Agent Studio",
      features: ["canvas-designer", "live-token-streaming", "hitl-approval", "circuit-breaker-llm"],
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
