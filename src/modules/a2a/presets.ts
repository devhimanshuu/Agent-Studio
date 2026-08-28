import { A2AAgentManifest } from "@/types/a2a";

/**
 * Curated directory of Google A2A compliant agents and presets for Agent Studio.
 * Users can browse, inspect, and drag these directly onto the visual canvas.
 */
export const A2A_AGENT_PRESETS: A2AAgentManifest[] = [
  {
    name: "google-gemini-researcher",
    displayName: "Google Gemini 2.0 Deep Research Agent",
    description: "Autonomous multimodal research specialist capable of web synthesis, cross-document reasoning, and deep structured reports.",
    version: "2.0.0",
    protocolVersion: "1.0.0",
    provider: {
      name: "Google DeepMind Ecosystem",
      url: "https://deepmind.google/technologies/gemini/",
    },
    endpoints: {
      tasks: "https://a2a.agents.google.dev/v1/gemini-researcher/tasks",
      messages: "https://a2a.agents.google.dev/v1/gemini-researcher/messages",
      stream: "https://a2a.agents.google.dev/v1/gemini-researcher/stream",
      health: "https://a2a.agents.google.dev/v1/gemini-researcher/health",
    },
    capabilities: [
      {
        id: "deep_research",
        name: "Deep Multi-Source Web Research",
        description: "Executes deep synthesis across multiple public and scholarly domains.",
        inputSchema: {
          topic: { type: "string", description: "Subject matter or research query" },
          depth: { type: "string", enum: ["standard", "exhaustive"], default: "standard" },
        },
        outputSchema: {
          executiveSummary: { type: "string" },
          findings: { type: "array", items: { type: "string" } },
          sources: { type: "array", items: { type: "string" } },
        },
        tags: ["research", "gemini", "search", "synthesis"],
      },
      {
        id: "trend_analysis",
        name: "Emerging Market & Tech Trend Analysis",
        description: "Identifies forward-looking industry shifts, growth vectors, and competitive dynamics.",
        tags: ["market-trends", "finance", "strategy"],
      },
    ],
    auth: {
      type: "bearer",
      headerName: "Authorization",
    },
    tags: ["google", "research", "multimodal", "flagship"],
  },
  {
    name: "autonomous-code-auditor",
    displayName: "Autonomous Security & AST Code Auditor",
    description: "Specialized A2A agent for static security analysis, vulnerability detection (CVEs, OWASP Top 10), and refactoring proposals.",
    version: "1.4.0",
    protocolVersion: "1.0.0",
    provider: {
      name: "SecureAgent Swarm Network",
      url: "https://secureagent.io",
    },
    endpoints: {
      tasks: "https://api.secureagent.io/a2a/auditor/tasks",
      messages: "https://api.secureagent.io/a2a/auditor/messages",
      health: "https://api.secureagent.io/a2a/auditor/health",
    },
    capabilities: [
      {
        id: "security_audit",
        name: "Full Codebase Security Audit",
        description: "Scans repository code snippets for memory leaks, injection risks, and secret leakage.",
        inputSchema: {
          codeSnippet: { type: "string" },
          language: { type: "string", default: "typescript" },
        },
        outputSchema: {
          vulnerabilities: { type: "array" },
          riskScore: { type: "number" },
          remediationPatch: { type: "string" },
        },
        tags: ["security", "audit", "ast", "code"],
      },
    ],
    auth: {
      type: "api_key",
      headerName: "X-A2A-API-Key",
    },
    tags: ["security", "code", "audit"],
  },
  {
    name: "financial-quant-analyst",
    displayName: "Financial Quant & Sentiment Analyst",
    description: "Calculates algorithmic portfolio risk metrics (Sharpe ratio, VaR), earnings surprises, and market sentiment.",
    version: "1.1.2",
    protocolVersion: "1.0.0",
    provider: {
      name: "QuantSwarm Labs",
      url: "https://quantswarm.ai",
    },
    endpoints: {
      tasks: "https://api.quantswarm.ai/v1/a2a/tasks",
      messages: "https://api.quantswarm.ai/v1/a2a/messages",
    },
    capabilities: [
      {
        id: "sentiment_risk_analysis",
        name: "Asset Sentiment & Risk Profiling",
        description: "Synthesizes real-time equity disclosures and news feeds into quantitative risk metrics.",
        tags: ["finance", "quant", "risk"],
      },
    ],
    auth: {
      type: "none",
    },
    tags: ["finance", "quant", "sentiment"],
  },
  {
    name: "local-studio-agent-gateway",
    displayName: "Agent Studio Self-Hosted A2A Node",
    description: "Loopback or private enterprise Agent Studio instance exposing internal skill pipelines over the A2A protocol.",
    version: "1.0.0",
    protocolVersion: "1.0.0",
    provider: {
      name: "Agent Studio Local Runtime",
      url: "http://localhost:3000",
    },
    endpoints: {
      tasks: "/api/a2a/tasks",
      messages: "/api/a2a/messages",
      health: "/api/health",
    },
    capabilities: [
      {
        id: "execute_skill",
        name: "Execute Internal Skill Graph",
        description: "Dispatches tasks into any published Agent Studio multi-agent graph with full HITL and tool permissions.",
        tags: ["internal", "skill", "graph"],
      },
    ],
    auth: {
      type: "none",
    },
    tags: ["local", "self-hosted", "bridge"],
  },
];
