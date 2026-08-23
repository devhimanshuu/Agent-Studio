import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/providers/llm";
import type { AgentGraphDefinition } from "@/types/graph";

const COPILOT_SYSTEM_PROMPT = `You are a graph architect for Agent Studio. Given a natural language description of a multi-agent system, generate a complete AgentGraphDefinition JSON.

Rules:
- Always include a "start" node (type: "start") and an "end" node (type: "end")
- Use appropriate node types: agent, supervisor, tool, router, approval, loop, parallel, subgraph
- Every agent/supervisor node must have a detailed system prompt
- Router nodes need condition expressions or routerPrompt
- Connect nodes with edges that have appropriate branch labels
- Position nodes in a left-to-right layout (start on left, end on right)
- Use meaningful labels and IDs
- Version must be 1

Response format: Return ONLY the JSON object with this exact structure:
{
  "version": 1,
  "nodes": [
    {
      "id": "unique_id",
      "type": "node_type",
      "position": { "x": number, "y": number },
      "data": { "label": "Label", ... }
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "optional_label"
    }
  ]
}

Node types and their data fields:
- start: { label }
- end: { label }
- agent: { label, prompt (system prompt), allowedTools? }
- supervisor: { label, prompt (routing instruction) }
- tool: { label, toolName, action, inputTemplate? }
- router: { label, routerMode: "deterministic"|"ai", condition?, routerPrompt? }
- approval: { label, approvalReason }
- loop: { label, maxIterations }
- parallel: { label, parallelMode: "map"|"reduce", mapField? }
- subgraph: { label, subgraph: { version: 1, nodes: [...], edges: [...] } }

Make sure:
1. The graph is well-connected (every node reachable from start, can reach end)
2. Router edges have labels (true/false or branch names)
3. Agent prompts are detailed and specific
4. Positions form a clear left-to-right flow with vertical stacking
5. Return ONLY valid JSON, no markdown fences, no explanation`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    const llm = getLLMProvider();
    const llmResponse = await llm.complete(
      [
        { role: "system", content: COPILOT_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { temperature: 0.4, maxTokens: 4096 }
    );

    // Extract JSON from the response (handle markdown fences, preambles, and conversational text)
    let jsonStr = llmResponse.content.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const jsonStart = jsonStr.indexOf("{");
      const jsonEnd = jsonStr.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1).trim();
      }
    }

    let graph: AgentGraphDefinition;
    try {
      graph = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to parse generated graph. The LLM output was not valid JSON." },
        { status: 422 }
      );
    }

    // Validate basic structure
    if (!graph.version || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return NextResponse.json(
        { success: false, error: "Generated graph has invalid structure (missing version/nodes/edges)" },
        { status: 422 }
      );
    }

    // Ensure required fields on nodes
    graph.version = 1;
    graph.nodes = graph.nodes.map((n, i) => ({
      ...n,
      id: n.id || `node_${i}`,
      type: n.type || "agent",
      position: n.position || { x: 100 + i * 250, y: 200 },
      data: { ...n.data, label: n.data?.label || n.id || `Node ${i}` },
    }));

    graph.edges = graph.edges.map((e, i) => ({
      ...e,
      id: e.id || `edge_${i + 1}`,
    }));

    return NextResponse.json({ success: true, graph });
  } catch (error) {
    console.error("[Canvas Copilot]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Graph generation failed",
      },
      { status: 500 }
    );
  }
}
