import { describe, it, expect } from "vitest";
import { evaluateExpression, ExpressionError } from "@/modules/graph/expression";

describe("expression evaluator", () => {
  const ctx = {
    results: {
      classifier: { decision: "high", riskLevel: "URGENT", count: 3 },
      agent_1: { content: "hello world" },
      tool: { amount: 750, ok: true },
    },
    input: { amount: 500, name: "Acme", active: true, items: [{ a: 1 }, { a: 2 }] },
  };

  it("evaluates simple equality on results", () => {
    expect(evaluateExpression('results.classifier.decision == "high"', ctx)).toBe(true);
    expect(evaluateExpression('results.classifier.decision == "low"', ctx)).toBe(false);
    expect(evaluateExpression('results.classifier.decision != "low"', ctx)).toBe(true);
  });

  it("evaluates numeric comparisons on input", () => {
    expect(evaluateExpression("input.amount > 400", ctx)).toBe(true);
    expect(evaluateExpression("input.amount >= 500", ctx)).toBe(true);
    expect(evaluateExpression("input.amount < 500", ctx)).toBe(false);
    expect(evaluateExpression("input.amount <= 499", ctx)).toBe(false);
  });

  it("evaluates boolean values and negation", () => {
    expect(evaluateExpression("input.active", ctx)).toBe(true);
    expect(evaluateExpression("!input.active", ctx)).toBe(false);
  });

  it("supports && and || with precedence", () => {
    expect(evaluateExpression('input.amount > 400 && results.classifier.decision == "high"', ctx)).toBe(true);
    expect(evaluateExpression('input.amount > 900 && results.classifier.decision == "high"', ctx)).toBe(false);
    expect(evaluateExpression('input.amount > 900 || results.classifier.decision == "high"', ctx)).toBe(true);
  });

  it("supports parentheses and unary minus", () => {
    expect(evaluateExpression('(input.amount > 400) && (results.classifier.count >= 3)', ctx)).toBe(true);
    expect(evaluateExpression("results.classifier.count == -(-3)", ctx)).toBe(true);
  });

  it("supports string operators", () => {
    expect(evaluateExpression('results.agent_1.content contains "world"', ctx)).toBe(true);
    expect(evaluateExpression('results.agent_1.content startsWith "hello"', ctx)).toBe(true);
    expect(evaluateExpression('results.agent_1.content endsWith "world"', ctx)).toBe(true);
  });

  it("supports array indexing via brackets", () => {
    expect(evaluateExpression("input.items[0].a == 1", ctx)).toBe(true);
    expect(evaluateExpression("input.items[1].a == 2", ctx)).toBe(true);
    expect(evaluateExpression('input.items["0"].a == 1', ctx)).toBe(true);
  });

  it("treats missing paths as falsy/undefined (no throw)", () => {
    expect(evaluateExpression("input.missing == null", ctx)).toBe(true);
    expect(evaluateExpression("results.nope.x.y == 1", ctx)).toBe(false);
  });

  it("evaluates negative numbers in comparison contexts", () => {
    expect(evaluateExpression("input.amount > -100", ctx)).toBe(true);
    expect(evaluateExpression("-50 < 0", ctx)).toBe(true);
    expect(evaluateExpression("results.classifier.count == -(-3)", ctx)).toBe(true);
  });

  it("throws a clear ExpressionError on syntax errors", () => {
    expect(() => evaluateExpression("results.x >", ctx)).toThrow(ExpressionError);
    expect(() => evaluateExpression("@@", ctx)).toThrow(ExpressionError);
    expect(() => evaluateExpression("", ctx)).toThrow(ExpressionError);
    expect(() => evaluateExpression("unknown.root.x == 1", ctx)).toThrow(/Unknown root/);
  });
});
