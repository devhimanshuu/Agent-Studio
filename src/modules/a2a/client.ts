import {
  A2AAgentManifest,
  A2ATaskRequest,
  A2ATaskResponse,
  A2AMessage,
} from "@/types/a2a";
import { A2A_AGENT_PRESETS } from "./presets";
import { logger } from "@/lib/logger";

export interface A2ADelegateOptions {
  authToken?: string;
  timeoutMs?: number;
  onTokenChunk?: (chunk: string, isThinking?: boolean) => void;
  signal?: AbortSignal;
}

/**
 * Discovers an A2A agent by fetching and validating its Agent Manifest (agent.json).
 * Checks `/.well-known/agent.json`, `/agent.json`, or the exact URL provided.
 */
export async function discoverA2AAgent(agentUrl: string): Promise<A2AAgentManifest> {
  const cleanUrl = agentUrl.trim().replace(/\/+$/, "");

  // Match against built-in presets first if URL matches or is a preset identifier
  const preset = A2A_AGENT_PRESETS.find(
    (p) => p.name === cleanUrl || p.endpoints.tasks.startsWith(cleanUrl) || cleanUrl.includes(p.name)
  );
  if (preset) {
    return preset;
  }

  const candidateUrls = [
    cleanUrl.endsWith(".json") ? cleanUrl : null,
    `${cleanUrl}/.well-known/agent.json`,
    `${cleanUrl}/agent.json`,
    `${cleanUrl}/api/a2a/manifest`,
    cleanUrl,
  ].filter(Boolean) as string[];

  let lastError: Error | null = null;

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const json = (await res.json()) as Partial<A2AAgentManifest>;
        if (json.name && json.endpoints?.tasks) {
          return {
            name: json.name,
            displayName: json.displayName || json.name,
            description: json.description || "A2A Autonomous Agent",
            version: json.version || "1.0.0",
            protocolVersion: (json.protocolVersion as "1.0.0") || "1.0.0",
            endpoints: json.endpoints,
            capabilities: json.capabilities || [],
            auth: json.auth || { type: "none" },
            tags: json.tags || ["a2a", "remote"],
            provider: json.provider,
          };
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // Genuinely unreachable — surface the failure instead of fabricating a manifest
  // that would make an unreachable agent look discovered and capability-complete.
  logger.warn({ agentUrl, err: lastError }, "A2A agent discovery failed — no manifest found at any candidate URL");
  throw new Error(
    `Could not discover an A2A agent at "${agentUrl}" (tried .well-known/agent.json, agent.json, /api/a2a/manifest, and the URL itself)` +
      (lastError ? `: ${lastError.message}` : "")
  );
}

/**
 * Delegates a structured task payload to a remote A2A agent endpoint.
 * Supports token streaming callbacks and JSON task responses.
 */
export async function delegateA2ATask(
  agentUrl: string,
  taskRequest: A2ATaskRequest,
  options: A2ADelegateOptions = {}
): Promise<A2ATaskResponse> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const taskId = taskRequest.taskId || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const started = Date.now();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (options.authToken) {
    headers["Authorization"] = options.authToken.startsWith("Bearer ")
      ? options.authToken
      : `Bearer ${options.authToken}`;
    headers["X-A2A-API-Key"] = options.authToken;
  }

  const endpoint = agentUrl.includes("/tasks") ? agentUrl : `${agentUrl.replace(/\/+$/, "")}/tasks`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...taskRequest, taskId }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Remote A2A agent returned HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "";

    // Handle SSE Stream response from A2A Agent
    if (contentType.includes("text/event-stream") && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedResult = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(dataStr) as {
              chunk?: string;
              text?: string;
              delta?: string;
              isThinking?: boolean;
            };
            const chunk = parsed.chunk || parsed.text || parsed.delta || "";
            if (chunk) {
              accumulatedResult += chunk;
              options.onTokenChunk?.(chunk, parsed.isThinking);
            }
          } catch {
            if (dataStr) {
              accumulatedResult += dataStr;
              options.onTokenChunk?.(dataStr, false);
            }
          }
        }
      }

      return {
        taskId,
        status: "completed",
        result: {
          output: accumulatedResult,
          delegatedVia: "A2A_STREAM",
        },
        durationMs: Date.now() - started,
      };
    }

    // Standard JSON response
    const json = (await res.json()) as Record<string, unknown>;
    return {
      taskId,
      status: "completed",
      result: json.result ?? json.output ?? json,
      durationMs: Date.now() - started,
      tokensUsed: typeof json.tokensUsed === "number" ? json.tokensUsed : undefined,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ endpoint, err: error }, "A2A task delegation failed");

    // Surface the real failure rather than fabricating a successful result —
    // callers (runA2ADelegateNode, the task auction) already handle a thrown
    // error or a "failed" status and decide whether to skip/retry/fail the run.
    throw new Error(`A2A task delegation to ${endpoint} failed after ${durationMs}ms: ${message}`);
  }
}

/**
 * Sends a message in a multi-agent A2A channel / debate dialogue.
 */
export async function sendA2AMessage(
  agentUrl: string,
  message: A2AMessage,
  authToken?: string
): Promise<{ reply: string; timestamp: number }> {
  const endpoint = agentUrl.includes("/messages") ? agentUrl : `${agentUrl.replace(/\/+$/, "")}/messages`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
      signal: controller.signal,
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`Remote A2A agent returned HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ""}`);
    }

    const json = (await res.json()) as { reply?: string; content?: string; response?: string };
    const reply = json.reply || json.content || json.response;
    if (!reply) {
      throw new Error("Remote A2A agent responded without a 'reply', 'content', or 'response' field");
    }
    return { reply, timestamp: Date.now() };
  } catch (error) {
    // Surface the real failure — no scripted "Consensus proposal accepted" stand-in.
    const message2 = error instanceof Error ? error.message : String(error);
    throw new Error(`A2A message to ${endpoint} failed: ${message2}`);
  } finally {
    clearTimeout(timer);
  }
}
