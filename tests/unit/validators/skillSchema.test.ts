import { describe, it, expect } from "vitest";
import { createSkillSchema, updateSkillSchema, skillListQuerySchema, publishSkillSchema } from "@/validators/skillSchema";

const validInput = {
  userId: "user_123",
  name: "Sentiment Analyzer",
  purpose: "Analyzes customer feedback sentiment at scale.",
  instructions: "Read the input text and classify sentiment as positive, negative, or neutral.",
  allowedTools: ["calculator"],
  maxExecutionSteps: 10,
};

describe("createSkillSchema", () => {
  it("accepts a valid skill definition", () => {
    const result = createSkillSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("requires a skill name", () => {
    const result = createSkillSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("requires a purpose", () => {
    const result = createSkillSchema.safeParse({ ...validInput, purpose: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path[0] === "purpose")).toBe(true);
  });

  it("requires instructions when provided to be non-trivial", () => {
    const result = createSkillSchema.safeParse({ ...validInput, instructions: "hi" });
    expect(result.success).toBe(false);
  });

  it("requires at least one allowed tool", () => {
    const result = createSkillSchema.safeParse({ ...validInput, allowedTools: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path[0] === "allowedTools")).toBe(true);
  });

  it("requires maxExecutionSteps to be greater than zero", () => {
    const result = createSkillSchema.safeParse({ ...validInput, maxExecutionSteps: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path[0] === "maxExecutionSteps")).toBe(true);
  });

  it("rejects non-object JSON schemas", () => {
    const result = createSkillSchema.safeParse({ ...validInput, inputSchema: [1, 2, 3] });
    expect(result.success).toBe(false);
  });

  it("rejects malformed examples structure", () => {
    const result = createSkillSchema.safeParse({
      ...validInput,
      examples: [{ input: {}, output: [] }], // output must be an object
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid examples", () => {
    const result = createSkillSchema.safeParse({
      ...validInput,
      examples: [{ input: { text: "great" }, output: { sentiment: "positive" }, description: "Happy review" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("updateSkillSchema", () => {
  it("accepts partial updates", () => {
    const result = updateSkillSchema.safeParse({ name: "Renamed" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty allowedTools array when provided", () => {
    const result = updateSkillSchema.safeParse({ allowedTools: [] });
    expect(result.success).toBe(false);
  });

  it("strips unknown fields (mass-assignment guard)", () => {
    const result = updateSkillSchema.safeParse({ unknownField: true, name: "Safe" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("unknownField");
  });
});

describe("skillListQuerySchema", () => {
  it("parses an empty query", () => {
    const result = skillListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("parses valid filters and sort", () => {
    const result = skillListQuerySchema.safeParse({ search: "sentiment", status: "PUBLISHED", sortBy: "name", sortOrder: "asc" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = skillListQuerySchema.safeParse({ status: "BOGUS" });
    expect(result.success).toBe(false);
  });
});

describe("publishSkillSchema", () => {
  it("requires versionId", () => {
    expect(publishSkillSchema.safeParse({}).success).toBe(false);
    expect(publishSkillSchema.safeParse({ versionId: "v_123" }).success).toBe(true);
  });
});
