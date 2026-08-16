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
  executionStatus: string | null;
  events: Array<{ type: string; nodeId?: string; detail?: string; at: number }>;
  connected: boolean;
}

const initialTrace: TraceState = {
  nodeStatuses: {},
  nodeDetails: {},
  traversedEdges: {},
  executionStatus: null,
  events: [],
  connected: false,
};

/**
 * Subscribes to the SSE execution stream for one execution and derives the
 * live node statuses that drive the pulsing canvas.
 */
export function useExecutionStream(executionId: string | null) {
  const [trace, setTrace] = useState<TraceState>(initialTrace);
  const sourceRef = useRef<EventSource | null>(null);
  const executionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!executionId) return;
    if (executionIdRef.current === executionId && sourceRef.current) return;
    executionIdRef.current = executionId;

    setTrace(initialTrace);
    const source = new EventSource(`/api/executions/${executionId}/stream`);
    sourceRef.current = source;

    const applyEvent = (event: ExecutionEvent) => {
      setTrace((prev) => {
        const next: TraceState = {
          ...prev,
          events:
            prev.events.length > 300 ? [...prev.events.slice(-299), { type: event.type, nodeId: "nodeId" in event ? event.nodeId : undefined, detail: "detail" in event ? event.detail : undefined, at: event.at }] : [...prev.events, { type: event.type, nodeId: "nodeId" in event ? event.nodeId : undefined, detail: "detail" in event ? event.detail : undefined, at: event.at }],
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
