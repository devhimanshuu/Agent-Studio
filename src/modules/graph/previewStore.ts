/**
 * In-memory store for ghost-mode preview sessions.
 *
 * A preview is a dry-run of the graph interpreter: nothing is persisted, so
 * there is no DB row to hang the SSE stream off. The create route stores the
 * run parameters here keyed by a `preview-…` id, and the stream route fans
 * out the interpreter's events for that id.
 *
 * Entries expire after PREVIEW_TTL_MS so abandoned previews don't leak.
 * Multi-instance deployments: a preview only lives on the instance that
 * created it — acceptable for a client-scoped preview tool.
 */

import { AgentGraphDefinition } from "@/types/graph";

interface PreviewSession {
  userId: string;
  skillVersionId: string;
  graph: AgentGraphDefinition;
  inputData: Record<string, unknown>;
  /** True once the dry-run has been kicked off by the first stream subscriber. */
  started: boolean;
  createdAt: number;
}

const PREVIEW_TTL_MS = 15 * 60 * 1000; // 15 minutes

const sessions = new Map<string, PreviewSession>();

function sweep(): void {
  const cutoff = Date.now() - PREVIEW_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) sessions.delete(id);
  }
}

export const previewStore = {
  set(id: string, session: PreviewSession): void {
    sweep();
    sessions.set(id, session);
  },

  get(id: string): PreviewSession | null {
    sweep();
    return sessions.get(id) ?? null;
  },

  delete(id: string): void {
    sessions.delete(id);
  },
};
