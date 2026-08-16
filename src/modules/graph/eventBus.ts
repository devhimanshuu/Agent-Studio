/**
 * In-process execution event bus.
 *
 * Graph nodes publish coarse-grained lifecycle events as they run
 * (node started / completed, edge traversed, execution status change). The
 * SSE stream route subscribes per execution id and fans them out to the canvas
 * trace view. In single-instance deployments this is lossless; for horizontally
 * scaled deployments, the SSE route also replays persisted ExecutionStep rows
 * on connect so late viewers still see the full trace.
 */

export type GraphNodeStatus = "RUNNING" | "SUCCESS" | "FAILED" | "AWAITING_APPROVAL" | "SKIPPED";

export interface ExecutionEventBase {
  executionId: string;
  /** Monotonic sequence for ordering on the client. */
  seq: number;
  /** Server timestamp (ms epoch). */
  at: number;
}

export interface NodeStartedEvent extends ExecutionEventBase {
  type: "node:start";
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
}

export interface NodeCompletedEvent extends ExecutionEventBase {
  type: "node:end";
  nodeId: string;
  status: GraphNodeStatus;
  /** Short summary of the node output for the trace console. */
  detail?: string;
  error?: string;
}

export interface EdgeTraversedEvent extends ExecutionEventBase {
  type: "edge:traverse";
  sourceId: string;
  targetId: string;
  /** Persisted edge id (for clients to highlight the exact edge). */
  edgeId?: string;
  label?: string;
}

export interface ExecutionStatusEvent extends ExecutionEventBase {
  type: "execution:status";
  status: string;
}

export interface ExecutionLogEvent extends ExecutionEventBase {
  type: "log";
  level: "info" | "warn" | "error";
  message: string;
}

export type ExecutionEvent =
  | NodeStartedEvent
  | NodeCompletedEvent
  | EdgeTraversedEvent
  | ExecutionStatusEvent
  | ExecutionLogEvent;

type Listener = (event: ExecutionEvent) => void;

/** Distributive mapped type — keeps each event variant's own fields. */
type PublishableEvent = {
  [E in ExecutionEvent as E["type"]]: Omit<E, "executionId" | "seq" | "at">;
}[ExecutionEvent["type"]];

class ExecutionEventBus {
  private listeners = new Map<string, Set<Listener>>();
  private counters = new Map<string, number>();

  /** Subscribe to events for one execution. Returns an unsubscribe fn. */
  subscribe(executionId: string, listener: Listener): () => void {
    let set = this.listeners.get(executionId);
    if (!set) {
      set = new Set();
      this.listeners.set(executionId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) this.listeners.delete(executionId);
    };
  }

  /** Publish an event to all listeners of one execution. */
  publish(executionId: string, event: PublishableEvent): void {
    const listeners = this.listeners.get(executionId);
    if (!listeners || listeners.size === 0) return;

    const seq = (this.counters.get(executionId) ?? 0) + 1;
    this.counters.set(executionId, seq);
    const full: ExecutionEvent = {
      ...(event as ExecutionEvent),
      executionId,
      seq,
      at: Date.now(),
    } as ExecutionEvent;
    for (const listener of listeners) {
      try {
        listener(full);
      } catch {
        // A slow/stale listener must never break the runtime.
      }
    }
  }
}

/** Singleton — one process-wide bus shared by the interpreter and SSE routes. */
export const executionEventBus = new ExecutionEventBus();
