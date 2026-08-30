import { describe, it, expect } from "vitest";
import { convertDifyToAgentGraph, convertDifyToWorkflowTemplate, parseDifyDslYaml } from "@/lib/converters/dify-converter";
import { convertN8nToAgentGraph, convertN8nToWorkflowTemplate, parseN8nWorkflowJson, N8nWorkflowData } from "@/lib/converters/n8n-converter";

describe("Dify Workflow Converter", () => {
  it("parses valid Dify YAML DSL into graph and template structures", () => {
    const yamlSample = `
version: "0.1.5"
app:
  name: "Document Summarizer"
  description: "Extracts and summarizes PDF documents"
  mode: "workflow"
workflow:
  graph:
    nodes:
      - id: "start-1"
        data:
          type: "start"
          title: "Input Text"
      - id: "llm-1"
        data:
          type: "llm"
          title: "Summarize"
          model:
            provider: "groq"
            name: "llama-3.3-70b-versatile"
          prompt_template: "Summarize: {{#input#}}"
      - id: "end-1"
        data:
          type: "end"
          title: "Result"
    edges:
      - id: "e1"
        source: "start-1"
        target: "llm-1"
      - id: "e2"
        source: "llm-1"
        target: "end-1"
`;

    const parsed = parseDifyDslYaml(yamlSample);
    expect(parsed.app?.name).toBe("Document Summarizer");

    const graph = convertDifyToAgentGraph(parsed);
    expect(graph.version).toBe(1);
    expect(graph.nodes.length).toBe(3);
    expect(graph.edges.length).toBe(2);
    expect(graph.nodes[1].data.model).toBe("llama-3.3-70b-versatile");

    const template = convertDifyToWorkflowTemplate({
      id: "test-dify",
      name: "Document Summarizer",
      overview: "Extracts and summarizes PDF documents",
      categories: ["OPERATIONS"],
      dsl: parsed,
    });

    expect(template.id).toBe("dify-test-dify");
    expect(template.name).toBe("Document Summarizer");
    expect(template.category).toBe("OPERATIONS");
  });

  it("handles malformed or empty DSL gracefully", () => {
    const emptyParsed = parseDifyDslYaml("invalid: [yaml: {");
    expect(emptyParsed).toEqual({});

    const fallbackGraph = convertDifyToAgentGraph(emptyParsed);
    expect(fallbackGraph.nodes.length).toBeGreaterThan(0);
    expect(fallbackGraph.nodes[0].type).toBe("start");
  });
});

describe("n8n Workflow Converter", () => {
  it("parses valid n8n JSON workflow into Studio graph", () => {
    const n8nJson = JSON.stringify({
      nodes: [
        {
          id: "1",
          name: "Webhook Trigger",
          type: "n8n-nodes-base.webhook",
          position: [100, 200],
          parameters: {
            path: "/hook",
            httpMethod: "POST",
          },
        },
        {
          id: "2",
          name: "AI Agent",
          type: "@n8n/n8n-nodes-langchain.agent",
          position: [400, 200],
          parameters: {
            prompt: "Answer user queries with tools",
          },
        },
      ],
      connections: {
        "Webhook Trigger": {
          main: [
            [
              {
                node: "AI Agent",
                type: "main",
                index: 0,
              },
            ],
          ],
        },
      },
    });

    const parsed = parseN8nWorkflowJson(n8nJson);
    expect(parsed?.nodes?.length).toBe(2);

    const graph = convertN8nToAgentGraph(parsed!);
    expect(graph.version).toBe(1);
    expect(graph.nodes.length).toBe(3);
    expect(graph.edges.length).toBe(2);
    expect(graph.nodes[0].type).toBe("start");
    expect(graph.nodes[1].type).toBe("agent");
    expect(graph.nodes[2].type).toBe("end");

    const template = convertN8nToWorkflowTemplate({
      id: 999,
      name: "n8n Auto Agent",
      description: "Processes incoming webhooks with an AI agent",
      workflow: parsed,
    });

    expect(template.id).toBe("n8n_999");
    expect(template.name).toBe("n8n Auto Agent");
  });

  it("handles empty or invalid n8n json safely", () => {
    const invalid = parseN8nWorkflowJson("not json");
    expect(invalid).toBeNull();

    const fallbackGraph = convertN8nToAgentGraph({ nodes: [] } as N8nWorkflowData);
    expect(fallbackGraph.nodes.length).toBeGreaterThan(0);
  });
});
