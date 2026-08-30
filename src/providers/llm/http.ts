import {
  LLMChatMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMError,
  LLMStreamChunk,
  LLMToolCall,
} from "./LLMProvider";

interface ChatCompletionRequestInput {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: LLMChatMessage[];
  options?: LLMCompletionOptions;
  providerName: string;
  /** Request timeout in ms (also used as the abort timeout). */
  timeoutMs: number;
  /** Optional extra headers (e.g. OpenRouter attribution headers). */
  extraHeaders?: Record<string, string>;
}

/**
 * Minimal OpenAI-compatible `/chat/completions` client (no SDK dependency).
 * Both Groq and OpenRouter speak this wire format. Errors are normalized into
 * LLMError with a status and a retryable flag the router can act on.
 */
export async function chatCompletionRequest(
  input: ChatCompletionRequestInput
): Promise<LLMCompletionResult> {
  const { endpoint, apiKey, model, messages, options, providerName, timeoutMs, extraHeaders } = input;

  const body: Record<string, unknown> = {
    model,
    messages,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    ...(options?.maxTokens !== undefined && { max_tokens: options.maxTokens }),
    ...(options?.stopSequences && options.stopSequences.length > 0 && { stop: options.stopSequences }),
    ...(options?.tools && options.tools.length > 0 && { tools: options.tools, tool_choice: "auto" }),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = controller.signal.aborted;
    throw new LLMError(aborted ? `LLM request to ${providerName} timed out` : `Network error calling ${providerName}`, {
      provider: providerName,
      model,
      status: aborted ? 408 : undefined,
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const json = (await response.json()) as { error?: { message?: string } | string };
      detail = typeof json?.error === "string" ? json.error : json?.error?.message ?? "";
    } catch {
      // Non-JSON error body — ignore, the status code carries the info.
    }
    const status = response.status;
    const retryable = status === 408 || status === 429 || status >= 500;
    throw new LLMError(`${providerName} returned ${status}${detail ? `: ${detail}` : ""}`, {
      provider: providerName,
      model,
      status,
      retryable,
    });
  }

  const data = (await response.json().catch(() => null)) as
    | {
        choices?: { message?: { content?: unknown; tool_calls?: unknown[] }; finish_reason?: unknown }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }
    | null;

  if (!data || !Array.isArray(data.choices) || !data.choices[0]?.message) {
    throw new LLMError(`Unexpected response shape from ${providerName}`, {
      provider: providerName,
      model,
      retryable: true,
    });
  }

  const message = data.choices[0].message;

  const toolCalls: LLMToolCall[] | undefined = Array.isArray(message.tool_calls)
    ? message.tool_calls.map((tc) => {
        const call = tc as { id?: string; function?: { name?: string; arguments?: unknown } };
        return {
          id: call?.id,
          name: call?.function?.name ?? "",
          arguments: typeof call?.function?.arguments === "string" ? call.function.arguments : "",
        };
      })
    : undefined;

  return {
    content: typeof message.content === "string" ? message.content : "",
    finishReason: mapFinishReason(data.choices[0].finish_reason),
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    ...(data.usage
      ? {
          usage: {
            inputTokens: data.usage.prompt_tokens ?? 0,
            outputTokens: data.usage.completion_tokens ?? 0,
          },
        }
      : {}),
  };
}

function mapFinishReason(reason: unknown): LLMCompletionResult["finishReason"] {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
      return "tool_calls";
    default:
      return "unknown";
  }
}

/**
 * Streaming variant of the OpenAI-compatible client. Returns an async iterable
 * of token chunks parsed from the SSE (`text/event-stream`) response.
 */
export async function streamChatCompletion(
  input: ChatCompletionRequestInput
): Promise<AsyncIterable<LLMStreamChunk>> {
  const { endpoint, apiKey, model, messages, options, providerName, timeoutMs, extraHeaders } = input;

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    ...(options?.maxTokens !== undefined && { max_tokens: options.maxTokens }),
    ...(options?.stopSequences && options.stopSequences.length > 0 && { stop: options.stopSequences }),
    ...(options?.tools && options.tools.length > 0 && { tools: options.tools, tool_choice: "auto" }),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const aborted = controller.signal.aborted;
    throw new LLMError(aborted ? `LLM stream to ${providerName} timed out` : `Network error calling ${providerName}`, {
      provider: providerName,
      model,
      status: aborted ? 408 : undefined,
      retryable: true,
      cause: error,
    });
  }

  if (!response.ok || !response.body) {
    clearTimeout(timer);
    let detail = "";
    try {
      const json = (await response.json()) as { error?: { message?: string } | string };
      detail = typeof json?.error === "string" ? json.error : json?.error?.message ?? "";
    } catch {
      // Non-JSON error body — ignore.
    }
    const status = response.status;
    throw new LLMError(`${providerName} returned ${status}${detail ? `: ${detail}` : ""}`, {
      provider: providerName,
      model,
      status,
      retryable: status === 408 || status === 429 || status >= 500,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function* iterate(): AsyncGenerator<LLMStreamChunk> {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            yield { type: "done" };
            return;
          }
          try {
            const json = JSON.parse(payload) as {
              choices?: { delta?: { content?: unknown; tool_calls?: unknown[] } }[];
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const delta = json?.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: "content", content: String(delta.content) };
            }
            if (Array.isArray(delta?.tool_calls)) {
              for (const raw of delta.tool_calls) {
                const tc = raw as { id?: string; function?: { name?: string; arguments?: unknown } };
                if (!tc?.function?.name) continue;
                yield {
                  type: "tool_call",
                  toolCall: {
                    id: tc.id,
                    name: tc.function.name,
                    arguments: typeof tc.function.arguments === "string" ? tc.function.arguments : "",
                  },
                };
              }
            }
            if (json?.usage) {
              yield {
                type: "done",
                usage: {
                  inputTokens: json.usage.prompt_tokens ?? 0,
                  outputTokens: json.usage.completion_tokens ?? 0,
                },
              };
            }
          } catch {
            // Malformed SSE payload — skip and keep reading.
          }
        }
      }
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }
    yield { type: "done" };
  }

  return iterate();
}
