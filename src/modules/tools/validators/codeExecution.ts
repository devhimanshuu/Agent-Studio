import { z } from "zod";

const CODE_LANGUAGES = ["javascript", "python"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const codeExecutionInputValidator = z.object({
  language: z.enum(CODE_LANGUAGES, {
    message: "Language must be 'javascript' or 'python'",
  }),
  code: z
    .string({ message: "Code must be a string" })
    .min(1, "Code cannot be empty")
    .max(50_000, "Code exceeds maximum length of 50,000 characters"),
  /** Optional timeout in milliseconds. Defaults to 10 000 ms, capped at 30 000 ms. */
  timeout: z
    .number({ message: "Timeout must be a number" })
    .int()
    .positive()
    .max(30_000, "Timeout cannot exceed 30 seconds")
    .optional(),
});

/** JSON Schema mirror of the Zod validator (used by the catalog + details UI). */
export const codeExecutionInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    language: { type: "string", enum: [...CODE_LANGUAGES] },
    code: { type: "string", minLength: 1, maxLength: 50_000 },
    timeout: { type: "integer", minimum: 1, maximum: 30_000 },
  },
  required: ["language", "code"],
  additionalProperties: false,
};

export const codeExecutionOutputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    language: { type: "string" },
    stdout: { type: "string" },
    stderr: { type: "string" },
    exitCode: { type: "number" },
    durationMs: { type: "number" },
    timedOut: { type: "boolean" },
  },
  required: ["language", "stdout", "stderr", "exitCode", "durationMs", "timedOut"],
};
