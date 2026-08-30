import { A2AAgentManifest } from "@/types/a2a";

/**
 * Presets for the A2A directory. This app does not operate or have access to any
 * live third-party A2A agent registry, so the only preset here is one this app
 * genuinely serves itself. Add real agents by their actual URL via "Discover" —
 * do not add speculative external agents here; a broken/fictitious endpoint in
 * this list would look identical to a real, reachable one in the directory UI.
 */
export const A2A_AGENT_PRESETS: A2AAgentManifest[] = [
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
