import { describe, it, expect } from "vitest";
import { resolveStepReferences, resolveStepReference } from "@/modules/execution/executor/stepReferences";

const ctx = {
  results: {
    step_1: { result: 810, action: "multiply" },
    step_2: { result: 531 },
  },
  userInput: { baseAmount: 4500, taxRate: 0.18, restockingFee: 250 },
};

describe("resolveStepReference", () => {
  it("resolves $step<N>.result to the tool's scalar result", () => {
    expect(resolveStepReference("$step1.result", ctx)).toEqual({ resolved: 810, found: true });
    expect(resolveStepReference("$step2.result", ctx)).toEqual({ resolved: 531, found: true });
  });

  it("resolves braced {{ step_<N>.result }} tokens", () => {
    expect(resolveStepReference("{{ step_1.result }}", ctx)).toEqual({ resolved: 810, found: true });
  });

  it("resolves {{ input.<path> }} and bare user-input templates", () => {
    expect(resolveStepReference("{{ input.baseAmount }}", ctx)).toEqual({ resolved: 4500, found: true });
    expect(resolveStepReference("{{ taxRate }}", ctx)).toEqual({ resolved: 0.18, found: true });
  });

  it("leaves unknown references untouched", () => {
    expect(resolveStepReference("$step9.result", ctx)).toEqual({ resolved: "$step9.result", found: false });
    expect(resolveStepReference("{{ missing }}", ctx)).toEqual({ resolved: "{{ missing }}", found: false });
  });
});

describe("resolveStepReferences", () => {
  it("keeps full-value references typed", () => {
    expect(resolveStepReferences("$step1.result", ctx)).toBe(810);
    expect(resolveStepReferences("{{ step_2.result }}", ctx)).toBe(531);
    expect(resolveStepReferences("{{ baseAmount }}", ctx)).toBe(4500);
  });

  it("resolves references nested inside objects and arrays", () => {
    const input = {
      a: "{{ baseAmount }}",
      b: "$step1.result",
      nested: { c: "{{ taxRate }}" },
      list: ["$step1.result", "plain"],
    };
    expect(resolveStepReferences(input, ctx)).toEqual({
      a: 4500,
      b: 810,
      nested: { c: 0.18 },
      list: [810, "plain"],
    });
  });

  it("interpolates embedded references as strings", () => {
    expect(resolveStepReferences("total after tax: $step1.result", ctx)).toBe("total after tax: 810");
    expect(resolveStepReferences("step1 gave {{ step_1.result }}", ctx)).toBe("step1 gave 810");
    expect(resolveStepReferences("base is {{ baseAmount }}", ctx)).toBe("base is 4500");
  });

  it("returns non-string values and primitives untouched", () => {
    expect(resolveStepReferences(42, ctx)).toBe(42);
    expect(resolveStepReferences(null, ctx)).toBe(null);
    expect(resolveStepReferences(true, ctx)).toBe(true);
  });
});
