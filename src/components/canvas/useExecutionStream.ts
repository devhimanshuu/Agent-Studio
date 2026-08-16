"use client";

import { useEffect, useRef, useState } from "react";
import { ExecutionEvent, GraphNodeStatus } from "@/modules/graph/eventBus";

export interface TraversedEdge {
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface TraceState {
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
}

const initialTrace: TraceState = {
  nodeStatuses: {},
  nodeDetails: {},
  traversedEdges: {},
  nodeDurations: {},
  executionStatus: null,
  events: [],
  connected: false,
};

/** Replay a prefix of the event log into the derived trace state (time-scrub). */
export function replayEvents(events: ExecutionEvent[]): {
  nodeStatuses: TraceState["nodeStatuses"];
  nodeDetails: TraceState["nodeDetails"];
  traversedEdges: TraceState["traversedEdges"];
  nodeDurations: TraceState["nodeDurations"];
  executionStatus: string | null;
} {
  const state: ReturnType<typeof replayEvents> = {
    nodeStatuses: {},
    nodeDetails: {},
    traversedEdges: {},
    nodeDurations: {},
    executionStatus: null,
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
          default:
            break;
        }
        return next;
      });
    };

    const handlers: Record<string, (e: MessageEvent) => void> = {};
    const eventTypes = ["node:start", "node:end", "edge:traverse", "execution:status"] as const;
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
