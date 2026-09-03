/**
 * In-memory A2A debate / channel session store.
 *
 * The A2A `messages` endpoint is now a real protocol with state: every dialogue
 * belongs to a `sessionId` (an `a2a_chan_<ulid>` string). Replaying the same
 * `sessionId` lets the LLM see the full transcript so turns become
 * context-aware rather than independent, generic responses.
 *
 * The store is in-process only — same caveat as `executionEventBus`. The
 * transcripts are bounded by TTL and per-session message count so a runaway
 * session can't leak memory across the process.
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity → drop
const MAX_TRANSCRIPT_TURNS = 60; // ~60 turns keeps total context bounded
const MAX_SESSIONS = 500; // cap concurrent debates per process

export interface DebateTurn {
  sender: string;
  role: "agent" | "user" | "system" | "mediator";
  content: string;
  turn: number;
  at: number;
}

export interface DebateSession {
  sessionId: string;
  ownerUserId: string | null;
  createdAt: number;
  lastActivityAt: number;
  topic: string | null;
  turns: DebateTurn[];
}

type Store = Map<string, DebateSession>;

const globalKey = "__agentStudioA2ASessions";

function getStore(): Store {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[globalKey]) {
    g[globalKey] = new Map<string, DebateSession>();
  }
  return g[globalKey] as Store;
}

function pruneExpired(now: number, store: Store): void {
  for (const [id, session] of store) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      store.delete(id);
    }
  }
}

function enforceCap(store: Store): void {
  if (store.size <= MAX_SESSIONS) return;
  // Drop the oldest N sessions (LRU by last activity).
  const sorted = [...store.entries()].sort(
    ([, a], [, b]) => a.lastActivityAt - b.lastActivityAt,
  );
  const overflow = store.size - MAX_SESSIONS;
  for (let i = 0; i < overflow; i++) {
    store.delete(sorted[i][0]);
  }
}

export function getOrCreateSession(
  sessionId: string,
  ownerUserId: string | null,
  topic?: string,
): DebateSession {
  const store = getStore();
  const now = Date.now();
  pruneExpired(now, store);

  const existing = store.get(sessionId);
  if (existing) {
    if (existing.ownerUserId && ownerUserId && existing.ownerUserId !== ownerUserId) {
      throw new SessionOwnershipError(sessionId);
    }
    existing.lastActivityAt = now;
    if (topic && !existing.topic) existing.topic = topic;
    return existing;
  }

  const session: DebateSession = {
    sessionId,
    ownerUserId,
    createdAt: now,
    lastActivityAt: now,
    topic: topic ?? null,
    turns: [],
  };
  store.set(sessionId, session);
  enforceCap(store);
  return session;
}

export function appendTurn(
  sessionId: string,
  turn: DebateTurn,
): DebateSession | null {
  const store = getStore();
  const session = store.get(sessionId);
  if (!session) return null;

  session.turns.push(turn);
  if (session.turns.length > MAX_TRANSCRIPT_TURNS) {
    session.turns.splice(0, session.turns.length - MAX_TRANSCRIPT_TURNS);
  }
  session.lastActivityAt = Date.now();
  return session;
}

export function getSession(sessionId: string): DebateSession | null {
  const store = getStore();
  const session = store.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
    store.delete(sessionId);
    return null;
  }
  return session;
}

export function getSessionStats(): { sessions: number; totalTurns: number } {
  const store = getStore();
  let totalTurns = 0;
  for (const s of store.values()) totalTurns += s.turns.length;
  return { sessions: store.size, totalTurns };
}

export class SessionOwnershipError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Session ${sessionId} is owned by a different user`);
    this.name = "SessionOwnershipError";
  }
}