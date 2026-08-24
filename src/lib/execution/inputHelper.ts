import { SkillVersionDTO } from "@/types/skill";

interface SchemaProperty {
  type?: string;
  default?: unknown;
  example?: unknown;
  [key: string]: unknown;
}

/**
 * Generates a prefilled, structured JSON input string for a skill or workflow.
 * Inspects existing examples, inputSchema definitions, and properties.
 */
export function getPrefilledExecutionInput(version?: SkillVersionDTO | null): string {
  if (!version) {
    return JSON.stringify(
      {
        query: "Sample execution task",
        payload: {},
      },
      null,
      2
    );
  }

  // 1. If an explicit example exists, use its input
  if (version.examples && version.examples.length > 0 && version.examples[0].input) {
    return JSON.stringify(version.examples[0].input, null, 2);
  }

  // 2. If inputSchema declares properties, generate a realistic sample
  const schemaProps = (version.inputSchema?.properties as Record<string, SchemaProperty> | undefined) || {};
  const propKeys = Object.keys(schemaProps);

  if (propKeys.length > 0) {
    const sample: Record<string, unknown> = {};

    for (const [key, prop] of Object.entries(schemaProps)) {
      if (prop.default !== undefined) {
        sample[key] = prop.default;
      } else if (prop.example !== undefined) {
        sample[key] = prop.example;
      } else if (prop.type === "number" || prop.type === "integer") {
        sample[key] = 100;
      } else if (prop.type === "boolean") {
        sample[key] = true;
      } else if (prop.type === "array") {
        sample[key] = ["sample_item_1"];
      } else if (prop.type === "object") {
        sample[key] = { sample_key: "sample_value" };
      } else {
        // String or fallback
        if (key.toLowerCase().includes("email")) sample[key] = "user@example.com";
        else if (key.toLowerCase().includes("name")) sample[key] = "Acme Corp";
        else if (key.toLowerCase().includes("id")) sample[key] = "INV-1002";
        else if (key.toLowerCase().includes("url")) sample[key] = "https://example.com";
        else sample[key] = `Sample ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`;
      }
    }

    return JSON.stringify(sample, null, 2);
  }

  // 3. Clean generic default
  return JSON.stringify(
    {
      query: "Analyze incoming support query and run agent loop",
      payload: {},
    },
    null,
    2
  );
}

/**
 * Safely parses the user's execution input string.
 * Converts empty input to `{}` and auto-wraps plain text into `{ query: text }`.
 */
export function safeParseExecutionInput(inputStr: string): Record<string, unknown> {
  const trimmed = (inputStr || "").trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { payload: parsed };
  } catch {
    // If user entered raw text without JSON brackets, wrap it as a query
    return { query: trimmed };
  }
}
