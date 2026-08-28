import { A2AAgentManifest, A2ATaskRequest, A2ATaskResponse, A2AMessage } from "@/types/a2a";
import { A2ADelegateOptions } from "@/modules/a2a/client";

export interface IA2AClientService {
  discover(agentUrl: string): Promise<A2AAgentManifest>;
  listPresets(): A2AAgentManifest[];
  delegate(
    agentUrl: string,
    taskRequest: A2ATaskRequest,
    options?: A2ADelegateOptions
  ): Promise<A2ATaskResponse>;
  sendMessage(
    agentUrl: string,
    message: A2AMessage,
    authToken?: string
  ): Promise<{ reply: string; timestamp: number }>;
}
