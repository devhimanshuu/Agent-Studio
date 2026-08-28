import { IA2AClientService } from "./interfaces/IA2AClientService";
import { A2AAgentManifest, A2ATaskRequest, A2ATaskResponse, A2AMessage } from "@/types/a2a";
import { discoverA2AAgent, delegateA2ATask, sendA2AMessage, A2ADelegateOptions } from "@/modules/a2a/client";
import { A2A_AGENT_PRESETS } from "@/modules/a2a/presets";

export class A2AClientService implements IA2AClientService {
  private cache = new Map<string, { manifest: A2AAgentManifest; expiresAt: number }>();
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async discover(agentUrl: string): Promise<A2AAgentManifest> {
    const cached = this.cache.get(agentUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.manifest;
    }

    const manifest = await discoverA2AAgent(agentUrl);
    this.cache.set(agentUrl, { manifest, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return manifest;
  }

  listPresets(): A2AAgentManifest[] {
    return A2A_AGENT_PRESETS;
  }

  async delegate(
    agentUrl: string,
    taskRequest: A2ATaskRequest,
    options?: A2ADelegateOptions
  ): Promise<A2ATaskResponse> {
    return delegateA2ATask(agentUrl, taskRequest, options);
  }

  async sendMessage(
    agentUrl: string,
    message: A2AMessage,
    authToken?: string
  ): Promise<{ reply: string; timestamp: number }> {
    return sendA2AMessage(agentUrl, message, authToken);
  }
}

export const a2aClientService = new A2AClientService();
