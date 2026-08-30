"use client";

import { useEffect, useRef, useState } from "react";
import { ExecutionEvent, GraphNodeStatus } from "@/modules/graph/eventBus";

interface TraversedEdge {
  sourceId: string;
  targetId: string;
  label?: string;
}

interface TraceState {
  nodeStatuses: Record<string, GraphNodeStatus>;
  nodeDetails: Record<string, string>;
  /** Edges traversed during the run, keyed by persisted edge id (or `source->target`). */
  traversedEdges: Record<string, TraversedEdge>;
  /** Cumulative per-node latency (ms) — sum + count for averaging (heatmap). */
  nodeDurations: Record<string, { total: number; count: number }>;
  executionStatus: string | null;
  /** Full ordered event log — drives the time-scrubber. */
  events: ExecutionEvent[];
  connected: boolean;
  // ─── Granular trace data ───
  /** Router decisions per node: { nodeId -> { chosenLabel, mode, reason } } */
  routerDecisions: Record<string, { chosenLabel: string; mode: string; reason?: string }>;
  /** Loop iteration state per node: { nodeId -> { iteration, maxIterations, exited } } */
  loopState: Record<string, { iteration: number; maxIterations: number; exited: boolean }>;
  /** Active parallel branches: { parentNodeId -> Set<branchNodeId> } */
  activeBranches: Record<string, string[]>;
  /** Tool call details per node: { nodeId -> { toolName, action, durationMs, status } } */
  toolCalls: Record<string, { toolName: string; action?: string; durationMs?: number; status: string }>;
  /** LLM call details per node: { nodeId -> { model, inputTokens, outputTokens, durationMs } } */
  llmCalls: Record<string, { model?: string; inputTokens?: number; outputTokens?: number; durationMs?: number }>;
  /** MCP tool call details per node: { nodeId -> { serverId, toolName, durationMs, status } } */
  mcpCalls: Record<string, { serverId: string; toolName: string; durationMs?: number; status: string }>;
  /** Approval state per node: { nodeId -> { reason, action, decision } } */
  approvalState: Record<string, { reason?: string; action?: string; decision?: string }>;
  /** Live Token Streaming per node: { nodeId -> { text, isThinking, tokensPerSec, totalTokens, active } } */
  tokenStreams: Record<string, { text: string; isThinking?: boolean; tokensPerSec?: number; totalTokens?: number; active: boolean }>;
  /** A2A Task delegation trace per node */
  a2aDelegations: Record<string, { agentUrl: string; capability?: string; status: string; taskId: string; durationMs?: number; tokensUsed?: number; error?: string }>;
  /** A2A Channel messages per node */
  a2aMessages: Record<string, Array<{ sender: string; content: string; turn: number; mode?: string }>>;
}

const initialTrace: TraceState = {
  nodeStatuses: {},
  nodeDetails: {},
  traversedEdges: {},
  nodeDurations: {},
  executionStatus: null,
  events: [],
  connected: false,
  routerDecisions: {},
  loopState: {},
  activeBranches: {},
  toolCalls: {},
  llmCalls: {},
  mcpCalls: {},
  approvalState: {},
  tokenStreams: {},
  a2aDelegations: {},
  a2aMessages: {},
};

/** Replay a prefix of the event log into the derived trace state (time-scrub). */
export function replayEvents(events: ExecutionEvent[]): {
  nodeStatuses: TraceState["nodeStatuses"];
  nodeDetails: TraceState["nodeDetails"];
  traversedEdges: TraceState["traversedEdges"];
  nodeDurations: TraceState["nodeDurations"];
  executionStatus: string | null;
  routerDecisions: TraceState["routerDecisions"];
  loopState: TraceState["loopState"];
  activeBranches: TraceState["activeBranches"];
  toolCalls: TraceState["toolCalls"];
  llmCalls: TraceState["llmCalls"];
  mcpCalls: TraceState["mcpCalls"];
  approvalState: TraceState["approvalState"];
  tokenStreams: TraceState["tokenStreams"];
  a2aDelegations: TraceState["a2aDelegations"];
  a2aMessages: TraceState["a2aMessages"];
} {
  const state: ReturnType<typeof replayEvents> = {
    nodeStatuses: {},
    nodeDetails: {},
    traversedEdges: {},
    nodeDurations: {},
    executionStatus: null,
    routerDecisions: {},
    loopState: {},
    activeBranches: {},
    toolCalls: {},
    llmCalls: {},
    mcpCalls: {},
    approvalState: {},
    tokenStreams: {},
    a2aDelegations: {},
    a2aMessages: {},
  };
  for (const event of events) {
    switch (event.type) {
      case "node:start":
        state.nodeStatuses[event.nodeId] = "RUNNING";
        state.nodeDetails[event.nodeId] = "executing…";
        break;
      case "node:end":
        state.nodeStatuses[event.nodeId] = event.status;
        if (event.detail) state.nodeDetails[event.nodeId] = event.detail;
        if (typeof event.durationMs === "number") {
          const prev = state.nodeDurations[event.nodeId] ?? { total: 0, count: 0 };
          state.nodeDurations[event.nodeId] = { total: prev.total + event.durationMs, count: prev.count + 1 };
        }
        break;
      case "edge:traverse": {
        const key = event.edgeId ?? `${event.sourceId}->${event.targetId}`;
        state.traversedEdges[key] = { sourceId: event.sourceId, targetId: event.targetId, label: event.label };
        break;
      }
      case "execution:status":
        state.executionStatus = event.status;
        break;
      case "router:decision":
        state.routerDecisions[event.nodeId] = {
          chosenLabel: event.chosenLabel,
          mode: event.mode,
          reason: event.reason,
        };
        break;
      case "loop:iteration":
        state.loopState[event.nodeId] = {
          iteration: event.iteration,
          maxIterations: event.maxIterations,
          exited: event.exited,
        };
        break;
      case "parallel:branch": {
        const branches = state.activeBranches[event.nodeId] ?? [];
        if (event.status === "started") {
          state.activeBranches[event.nodeId] = [...branches, event.branchNodeId];
        } else {
          state.activeBranches[event.nodeId] = branches.filter((b) => b !== event.branchNodeId);
        }
        break;
      }
      case "tool:call:start":
        state.toolCalls[event.nodeId] = {
          toolName: event.toolName,
          action: event.action,
          status: "RUNNING",
        };
        break;
      case "tool:call:end":
        state.toolCalls[event.nodeId] = {
          ...state.toolCalls[event.nodeId],
          toolName: event.toolName,
          status: event.status,
          durationMs: event.durationMs,
        };
        break;
      case "llm:call:start":
        state.llmCalls[event.nodeId] = {
          model: event.model,
        };
        break;
      case "llm:call:end":
        state.llmCalls[event.nodeId] = {
          ...state.llmCalls[event.nodeId],
          model: event.model,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          durationMs: event.durationMs,
        };
        break;
      case "mcp:tool:start":
        state.mcpCalls[event.nodeId] = {
          serverId: event.serverId,
          toolName: event.toolName,
          status: "RUNNING",
        };
        break;
      case "mcp:tool:end":
        state.mcpCalls[event.nodeId] = {
          ...state.mcpCalls[event.nodeId],
          serverId: event.serverId,
          toolName: event.toolName,
          status: event.status,
          durationMs: event.durationMs,
        };
        break;
      case "approval:requested":
        state.approvalState[event.nodeId] = {
          reason: event.reason,
          action: event.action,
        };
        break;
      case "approval:resolved":
        state.approvalState[event.nodeId] = {
          ...state.approvalState[event.nodeId],
          decision: event.decision,
        };
        break;
      case "node:token_chunk": {
        const prevStream = state.tokenStreams[event.nodeId] ?? { text: "", active: true };
        state.tokenStreams[event.nodeId] = {
          text: (prevStream.text || "") + event.chunk,
          isThinking: event.isThinking,
          tokensPerSec: event.tokensPerSec,
          totalTokens: event.totalTokens,
          active: true,
        };
        break;
      }
      case "a2a:task:delegated": {
        state.a2aDelegations[event.nodeId] = {
          agentUrl: event.agentUrl,
          capability: event.capability,
          status: event.status,
          taskId: event.taskId,
          durationMs: event.durationMs,
          tokensUsed: event.tokensUsed,
          error: event.error,
        };
        break;
      }
      case "a2a:message:exchange": {
        const msgs = state.a2aMessages[event.nodeId] ?? [];
        state.a2aMessages[event.nodeId] = [
          ...msgs,
          { sender: event.sender, content: event.content, turn: event.turn, mode: event.mode },
        ];
        break;
      }
      default:
        break;
    }
  }
  return state;
}

/**
 * Subscribes to an SSE execution stream (real runs or ghost previews) and
 * derives the live node statuses that drive the pulsing canvas.
 */
export function useExecutionStream(
  executionId: string | null,
  options?: { endpoint?: (id: string) => string }
) {
  const [trace, setTrace] = useState<TraceState>(initialTrace);
  const sourceRef = useRef<EventSource | null>(null);
  const executionIdRef = useRef<string | null>(null);
  const endpointRef = useRef(options?.endpoint);
  endpointRef.current = options?.endpoint;

  useEffect(() => {
    if (!executionId) return;
    if (executionIdRef.current === executionId && sourceRef.current) return;
    executionIdRef.current = executionId;

    setTrace(initialTrace);
    const url = endpointRef.current ? endpointRef.current(executionId) : `/api/executions/${executionId}/stream`;
    const source = new EventSource(url);
    sourceRef.current = source;

    const applyEvent = (event: ExecutionEvent) => {
      setTrace((prev) => {
        const next: TraceState = {
          ...prev,
          events: prev.events.length > 500 ? [...prev.events.slice(-499), event] : [...prev.events, event],
        };

        switch (event.type) {
          case "node:start": {
            next.nodeStatuses = { ...prev.nodeStatuses, [event.nodeId]: "RUNNING" };
            next.nodeDetails = { ...prev.nodeDetails, [event.nodeId]: "executing…" };
            next.tokenStreams = {
              ...prev.tokenStreams,
              [event.nodeId]: { text: "", active: true },
            };
            break;
          }
          case "node:end": {
            next.nodeStatuses = { ...prev.nodeStatuses, [event.nodeId]: event.status };
            if (event.detail) next.nodeDetails = { ...prev.nodeDetails, [event.nodeId]: event.detail };
            if (typeof event.durationMs === "number") {
              const prevDur = prev.nodeDurations[event.nodeId] ?? { total: 0, count: 0 };
              next.nodeDurations = {
                ...prev.nodeDurations,
                [event.nodeId]: { total: prevDur.total + event.durationMs, count: prevDur.count + 1 },
              };
            }
            if (prev.tokenStreams[event.nodeId]) {
              next.tokenStreams = {
                ...prev.tokenStreams,
                [event.nodeId]: { ...prev.tokenStreams[event.nodeId], active: false },
              };
            }
            break;
          }
          case "edge:traverse": {
            const key = event.edgeId ?? `${event.sourceId}->${event.targetId}`;
            next.traversedEdges = {
              ...prev.traversedEdges,
              [key]: { sourceId: event.sourceId, targetId: event.targetId, label: event.label },
            };
            break;
          }
          case "execution:status": {
            next.executionStatus = event.status;
            break;
          }
          case "router:decision": {
            next.routerDecisions = {
              ...prev.routerDecisions,
              [event.nodeId]: {
                chosenLabel: event.chosenLabel,
                mode: event.mode,
                reason: event.reason,
              },
            };
            break;
          }
          case "loop:iteration": {
            next.loopState = {
              ...prev.loopState,
              [event.nodeId]: {
                iteration: event.iteration,
                maxIterations: event.maxIterations,
                exited: event.exited,
              },
            };
            break;
          }
          case "parallel:branch": {
            const branches = prev.activeBranches[event.nodeId] ?? [];
            next.activeBranches = {
              ...prev.activeBranches,
              [event.nodeId]: event.status === "started"
                ? [...branches, event.branchNodeId]
                : branches.filter((b) => b !== event.branchNodeId),
            };
            break;
          }
          case "tool:call:start": {
            next.toolCalls = {
              ...prev.toolCalls,
              [event.nodeId]: { toolName: event.toolName, action: event.action, status: "RUNNING" },
            };
            break;
          }
          case "tool:call:end": {
            next.toolCalls = {
              ...prev.toolCalls,
              [event.nodeId]: {
                ...prev.toolCalls[event.nodeId],
                toolName: event.toolName,
                status: event.status,
                durationMs: event.durationMs,
              },
            };
            break;
          }
          case "llm:call:start": {
            next.llmCalls = {
              ...prev.llmCalls,
              [event.nodeId]: { model: event.model },
            };
            break;
          }
          case "llm:call:end": {
            next.llmCalls = {
              ...prev.llmCalls,
              [event.nodeId]: {
                ...prev.llmCalls[event.nodeId],
                model: event.model,
                inputTokens: event.inputTokens,
                outputTokens: event.outputTokens,
                durationMs: event.durationMs,
              },
            };
            break;
          }
          case "mcp:tool:start": {
            next.mcpCalls = {
              ...prev.mcpCalls,
              [event.nodeId]: { serverId: event.serverId, toolName: event.toolName, status: "RUNNING" },
            };
            break;
          }
          case "mcp:tool:end": {
            next.mcpCalls = {
              ...prev.mcpCalls,
              [event.nodeId]: {
                ...prev.mcpCalls[event.nodeId],
                serverId: event.serverId,
                toolName: event.toolName,
                status: event.status,
                durationMs: event.durationMs,
              },
            };
            break;
          }
          case "approval:requested": {
            next.approvalState = {
              ...prev.approvalState,
              [event.nodeId]: { reason: event.reason, action: event.action },
            };
            break;
          }
          case "approval:resolved": {
            next.approvalState = {
              ...prev.approvalState,
              [event.nodeId]: { ...prev.approvalState[event.nodeId], decision: event.decision },
            };
            break;
          }
          case "node:token_chunk": {
            const current = prev.tokenStreams[event.nodeId] ?? { text: "", active: true };
            next.tokenStreams = {
              ...prev.tokenStreams,
              [event.nodeId]: {
                text: current.text + event.chunk,
                isThinking: event.isThinking,
                tokensPerSec: event.tokensPerSec,
                totalTokens: event.totalTokens,
                active: true,
              },
            };
            break;
          }
          case "a2a:task:delegated": {
            next.a2aDelegations = {
              ...prev.a2aDelegations,
              [event.nodeId]: {
                agentUrl: event.agentUrl,
                capability: event.capability,
                status: event.status,
                taskId: event.taskId,
                durationMs: event.durationMs,
                tokensUsed: event.tokensUsed,
                error: event.error,
              },
            };
            break;
          }
          case "a2a:message:exchange": {
            const msgs = prev.a2aMessages[event.nodeId] ?? [];
            next.a2aMessages = {
              ...prev.a2aMessages,
              [event.nodeId]: [
                ...msgs,
                { sender: event.sender, content: event.content, turn: event.turn, mode: event.mode },
              ],
            };
            break;
          }
          default:
            break;
        }
        return next;
      });
    };

    const handlers: Record<string, (e: MessageEvent) => void> = {};
    const eventTypes = [
      "node:start", "node:end", "edge:traverse", "execution:status",
      "router:decision", "loop:iteration", "parallel:branch",
      "tool:call:start", "tool:call:end",
      "llm:call:start", "llm:call:end",
      "node:token_chunk",
      "mcp:tool:start", "mcp:tool:end",
      "a2a:task:delegated", "a2a:message:exchange",
      "approval:requested", "approval:resolved",
    ] as const;
    for (const type of eventTypes) {
      handlers[type] = (e: MessageEvent) => applyEvent(JSON.parse(e.data) as ExecutionEvent);
      source.addEventListener(type, handlers[type]);
    }
    // Fallback listener for any untyped event frames (defensive).
    source.onmessage = (e: MessageEvent) => {
      try {
        applyEvent(JSON.parse(e.data) as ExecutionEvent);
      } catch {
        // Ignore non-JSON keep-alive frames.
      }
    };

    source.onopen = () => setTrace((prev) => ({ ...prev, connected: true }));
    source.onerror = () => {
      // EventSource auto-reconnects; surface the state so the UI can hint.
      setTrace((prev) => ({ ...prev, connected: false }));
    };

    return () => {
      for (const [type, handler] of Object.entries(handlers)) {
        source.removeEventListener(type, handler);
      }
      source.onmessage = null;
      source.onopen = null;
      source.onerror = null;
      source.close();
      sourceRef.current = null;
    };
     
  }, [executionId]);

  return trace;
}
