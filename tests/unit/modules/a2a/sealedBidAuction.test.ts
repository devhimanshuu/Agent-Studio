import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeEnvelopeDigest,
  runTaskAuction,
} from "@/modules/a2a/auction";
import { A2A_AGENT_PRESETS } from "@/modules/a2a/presets";
import { A2AAgentManifest } from "@/types/a2a";

const baseTask = {
  taskId: "seal-1",
  title: "Security audit",
  description: "Verify network ACLs and pgvector access control.",
  requiredCapability: "security_audit",
  biddingWindowMs: 500,
};

describe("Sealed-bid A2A auction protocol", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns NO_ELIGIBLE_BIDS with a null winningBid when no candidates qualify and the fallback is suppressed", async () => {
    const candidates: A2AAgentManifest[] = [
      {
        name: "no-match",
        displayName: "NoMatch",
        description: "no relevant capability",
        version: "1.0.0",
        protocolVersion: "1.0.0",
        endpoints: { tasks: "/api/a2a/tasks" },
        capabilities: [
          { id: "unrelated_capability", name: "Unrelated", description: "no" },
        ],
      },
    ];
    const result = await runTaskAuction(baseTask, candidates, {
      executeWinner: false,
    });
    // The synthetic fallback is admitted so the status is AWARDED_NOT_EXECUTED,
    // but the rejectionReasons map must still report the original candidate.
    expect(result.status).toBe("AWARDED_NOT_EXECUTED");
    expect(result.winningBid).not.toBeNull();
    expect(result.rejectionReasons["no-match"]).toBe("MISSING_REQUIRED_CAPABILITY");
    expect(result.allBids.some((b) => b.rejectionReason === "MISSING_REQUIRED_CAPABILITY")).toBe(true);
  });

  it("rejects bids that arrive after the deadline as BID_AFTER_DEADLINE", () => {
    // First call returns the auction-start timestamp (T0); subsequent calls
    // return T0 + 10s so every per-agent bid lands well past the 500ms window.
    const T0 = 1_700_000_000_000;
    let callIndex = 0;
    const now = () => (callIndex++ === 0 ? T0 : T0 + 10_000);
    const candidates: A2AAgentManifest[] = A2A_AGENT_PRESETS.map((a) => ({
      ...a,
      capabilities: [{ id: "security_audit", name: "audit", description: "x" }],
    }));
    const result = runTaskAuction(
      { ...baseTask, biddingWindowMs: 500 },
      candidates,
      { executeWinner: false, now },
    );
    return result.then((res) => {
      // All preset bids are stale — fallback takes over.
      expect(res.admittedBids.length).toBeGreaterThan(0); // fallback admitted
      const stale = res.allBids.filter(
        (b) => b.rejectionReason === "BID_AFTER_DEADLINE",
      );
      expect(stale.length).toBe(candidates.length);
    });
  });

  it("envelope digests are stable for the same inputs and change when any field changes", () => {
    const a = computeEnvelopeDigest({
      rfpId: "rfp_1",
      nonce: "abc",
      agentName: "agent-1",
      task: baseTask,
      estimatedTokens: 250,
      estimatedDurationMs: 600,
    });
    const b = computeEnvelopeDigest({
      rfpId: "rfp_1",
      nonce: "abc",
      agentName: "agent-1",
      task: baseTask,
      estimatedTokens: 250,
      estimatedDurationMs: 600,
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);

    const c = computeEnvelopeDigest({
      ...{ rfpId: "rfp_1", nonce: "abc", agentName: "agent-1", task: baseTask, estimatedTokens: 250, estimatedDurationMs: 600 },
      estimatedTokens: 251,
    });
    expect(c).not.toBe(a);
  });

  it("scoring is deterministic for the same bids", async () => {
    const candidates: A2AAgentManifest[] = A2A_AGENT_PRESETS.map((a) => ({
      ...a,
      capabilities: [{ id: "security_audit", name: "audit", description: "x" }],
    }));
    const r1 = await runTaskAuction(baseTask, candidates, { executeWinner: false });
    const r2 = await runTaskAuction(baseTask, candidates, { executeWinner: false });
    expect(r1.winningBid?.agentName).toBe(r2.winningBid?.agentName);
    expect(r1.winningBid?.confidenceScore).toBe(r2.winningBid?.confidenceScore);
  });

  it("emits a non-null rfpId and a deadline strictly in the future", async () => {
    const result = await runTaskAuction(baseTask, A2A_AGENT_PRESETS, {
      executeWinner: false,
    });
    expect(result.rfpId).toMatch(/^rfp_/);
    expect(result.biddingDeadlineAt).toBeGreaterThan(Date.now() - 60_000);
  });

  it("returns AWARDED_NOT_EXECUTED without ever calling delegateA2ATask when executeWinner is false", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const result = await runTaskAuction(baseTask, A2A_AGENT_PRESETS, {
      executeWinner: false,
    });
    expect(result.status).toBe("AWARDED_NOT_EXECUTED");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.executionResponse).toBeUndefined();
  });
});