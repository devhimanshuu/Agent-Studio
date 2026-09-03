import { describe, it, expect, beforeEach } from "vitest";
import {
  getOrCreateSession,
  getSession,
  appendTurn,
  getSessionStats,
  SessionOwnershipError,
} from "@/modules/a2a/debateStore";

const makeTurn = (turn: number, content = `msg-${turn}`) => ({
  sender: "Test Agent",
  role: "agent" as const,
  content,
  turn,
  at: 1_700_000_000_000 + turn,
});

describe("A2A debate session store", () => {
  beforeEach(() => {
    // Force a fresh module instance per test.
    const g = globalThis as unknown as Record<string, unknown>;
    delete g["__agentStudioA2ASessions"];
  });

  it("creates a new session with owner", () => {
    const s = getOrCreateSession("sess-1", "user-a", "compare pgvector vs qdrant");
    expect(s.ownerUserId).toBe("user-a");
    expect(s.topic).toBe("compare pgvector vs qdrant");
    expect(s.turns).toEqual([]);
  });

  it("throws SessionOwnershipError when a different user re-opens the same session", () => {
    getOrCreateSession("sess-2", "user-a");
    expect(() => getOrCreateSession("sess-2", "user-b")).toThrow(SessionOwnershipError);
  });

  it("appends turns and exposes them in order", () => {
    getOrCreateSession("sess-3", "user-a");
    appendTurn("sess-3", makeTurn(1, "first"));
    appendTurn("sess-3", makeTurn(2, "second"));
    const s = getSession("sess-3");
    expect(s?.turns).toHaveLength(2);
    expect(s?.turns[0].content).toBe("first");
    expect(s?.turns[1].content).toBe("second");
  });

  it("caps the transcript at MAX_TRANSCRIPT_TURNS so context stays bounded", () => {
    getOrCreateSession("sess-4", "user-a");
    for (let i = 0; i < 80; i++) appendTurn("sess-4", makeTurn(i));
    const refreshed = getSession("sess-4");
    expect(refreshed?.turns.length).toBeLessThanOrEqual(60);
    expect(refreshed?.turns.length).toBeGreaterThan(0);
    // Most-recent turn is preserved.
    expect(refreshed?.turns[refreshed.turns.length - 1].turn).toBe(79);
  });

  it("returns null for an unknown session id", () => {
    expect(getSession("does-not-exist")).toBeNull();
  });

  it("stats reflect current session + turn counts", () => {
    getOrCreateSession("sess-5", "user-a");
    getOrCreateSession("sess-6", "user-a");
    appendTurn("sess-5", makeTurn(1));
    appendTurn("sess-5", makeTurn(2));
    appendTurn("sess-6", makeTurn(1));
    const stats = getSessionStats();
    expect(stats.sessions).toBeGreaterThanOrEqual(2);
    expect(stats.totalTurns).toBeGreaterThanOrEqual(3);
  });
});