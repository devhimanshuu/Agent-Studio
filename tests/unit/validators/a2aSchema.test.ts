import { describe, it, expect } from "vitest";
import { A2AMessageSchema } from "@/validators/a2aSchema";

describe("A2AMessageSchema", () => {
  it("accepts a well-formed message with default role", () => {
    const result = A2AMessageSchema.parse({
      sender: "agent-A",
      content: "Hello, world",
    });
    expect(result.role).toBe("agent");
    expect(result.sender).toBe("agent-A");
  });

  it("rejects empty content", () => {
    expect(() =>
      A2AMessageSchema.parse({ sender: "x", content: "" }),
    ).toThrow();
  });

  it("rejects content larger than 8KB to prevent token-spam abuse", () => {
    const huge = "x".repeat(9_000);
    expect(() =>
      A2AMessageSchema.parse({ sender: "x", content: huge }),
    ).toThrow();
  });

  it("rejects unknown role values", () => {
    expect(() =>
      A2AMessageSchema.parse({
        sender: "x",
        content: "ok",
        role: "moderator-fake",
      }),
    ).toThrow();
  });

  it("accepts all valid roles", () => {
    for (const role of ["agent", "user", "system", "mediator"]) {
      const result = A2AMessageSchema.parse({
        sender: "x",
        content: "ok",
        role,
      });
      expect(result.role).toBe(role);
    }
  });
});