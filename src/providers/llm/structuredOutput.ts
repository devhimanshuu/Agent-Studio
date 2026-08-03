import { z } from "zod";
import { LLMProvider, LLMChatMessage, LLMCompletionOptions, LLMError } from "./LLMProvider";

/**
 * Prompt-based structured output. Sends a strict JSON instruction, parses the
 * first JSON object out of the model reply, and validates it against a Zod
 * schema. On any parse/validation failure an LLMError (retryable) is thrown so
 * the router can fail over to another model.
 *
 * Works across every Groq/OpenRouter model without relying on vendor-specific
 * `response_format` support.
 */
export async function requestStructuredOutput<T>(
  provider: LLMProvider,
  messages: LLMChatMessage[],
  schema: z.ZodType<T>,
  options?: LLMCompletionOptions
): Promise<T> {
  const jsonMessages: LLMChatMessage[] = [
    {
      role: "system",
      content:
        "You are a precise JSON generator. Respond with ONLY a single valid JSON object that matches the requested schema exactly. No markdown, no code fences, no explanatory prose.",
    },
    ...messages,
  ];

  const result = await provider.generate(jsonMessages, { ...options, temperature: options?.temperature ?? 0 });

  let parsed: unknown;
  try {
    parsed = extractJsonObject(result.content);
  } catch (error) {
    throw new LLMError(`Model returned no parseable JSON: ${error instanceof Error ? error.message : "parse failed"}`, {
      provider: provider.name,
      model: provider.model,
      retryable: true,
    });
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new LLMError(`Model returned invalid structured output: ${validated.error.message}`, {
      provider: provider.name,
      model: provider.model,
      retryable: true,
    });
  }

  return validated.data;
}

/** Extract the first JSON object (from `{` to the last `}`) out of a model reply. */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}
