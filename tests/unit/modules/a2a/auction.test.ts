import { describe, it, expect } from "vitest";
import { runTaskAuction } from "@/modules/a2a/auction";
import { A2A_AGENT_PRESETS } from "@/modules/a2a/presets";

describe("Autonomous Multi-Agent Task Bidding & Auction Protocol", () => {
  it("broadcasts task RFP and scores candidate agent bids dynamically", async () => {
    const auction = await runTaskAuction(
      {
        taskId: "test-task-1",
        title: "Database Security Verification",
        description: "Verify PostgreSQL pgvector index access permissions and network security.",
        requiredCapability: "autonomous_delegation",
      },
      A2A_AGENT_PRESETS,
      { executeWinner: false }
    );

    expect(auction.status).toBe("AWARDED_NOT_EXECUTED");
    expect(auction.allBids.length).toBeGreaterThan(0);
    expect(auction.winningBid).not.toBeNull();
    expect(auction.winningBid?.agentName).toBeTruthy();
    expect(auction.winningBid?.confidenceScore).toBeGreaterThan(0.5);
    expect(auction.rfpId).toMatch(/^rfp_/);
    expect(auction.biddingDeadlineAt).toBeGreaterThan(Date.now() - 60_000);
    expect(auction.admittedBids.length).toBeGreaterThan(0);
  });
});
