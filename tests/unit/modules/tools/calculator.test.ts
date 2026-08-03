import { describe, it, expect } from "vitest";
import { calculatorTool } from "@/modules/tools";

interface CalculatorOutput {
  action: string;
  expression: string;
  result: number;
}

async function calc(input: Record<string, unknown>): Promise<CalculatorOutput> {
  return (await calculatorTool.execute(input)) as CalculatorOutput;
}

describe("Calculator tool", () => {
  it("adds, subtracts, multiplies and divides", async () => {
    expect(await calc({ action: "add", a: 2, b: 3 })).toMatchObject({ action: "add", result: 5 });
    expect(await calc({ action: "subtract", a: 10, b: 4 })).toMatchObject({ result: 6 });
    expect(await calc({ action: "multiply", a: 6, b: 7 })).toMatchObject({ result: 42 });
    expect(await calc({ action: "divide", a: 10, b: 4 })).toMatchObject({ result: 2.5 });
  });

  it("computes percentage, power and square root", async () => {
    expect(await calc({ action: "percentage", a: 20, b: 50 })).toMatchObject({ result: 10 });
    expect(await calc({ action: "power", a: 2, b: 10 })).toMatchObject({ result: 1024 });
    expect(await calc({ action: "sqrt", a: 16 })).toMatchObject({ result: 4 });
  });

  it("returns a structured expression with the result", async () => {
    const output = await calc({ action: "add", a: 2, b: 3 });
    expect(output).toEqual({ action: "add", expression: "2 + 3 = 5", result: 5 });
  });

  it("trims floating-point noise", async () => {
    const output = await calc({ action: "add", a: 0.1, b: 0.2 });
    expect(output.result).toBe(0.3);
  });

  it("rejects division by zero", async () => {
    expect(calculatorTool.validate({ action: "divide", a: 1, b: 0 })).toContain("Cannot divide by zero");
  });

  it("rejects square root of a negative number", async () => {
    expect(calculatorTool.validate({ action: "sqrt", a: -4 }).join(" ")).toMatch(/square root of a negative number/);
  });

  it("requires the second operand for every action except sqrt", async () => {
    expect(calculatorTool.validate({ action: "add", a: 1 }).join(" ")).toMatch(/requires a second operand/);
  });

  it("rejects unknown actions and non-numeric operands", async () => {
    const issues = calculatorTool.validate({ action: "modulo", a: 1, b: 2 });
    expect(issues.join(" ")).toMatch(/Unknown calculator action/);
    expect(calculatorTool.validate({ action: "add", a: "one", b: 2 }).join(" ")).toMatch(/a must be a number/);
  });

  it("reports healthy", async () => {
    await expect(calculatorTool.healthCheck()).resolves.toMatchObject({ status: "healthy" });
  });
});
