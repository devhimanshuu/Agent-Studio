import { NextResponse } from "next/server";
import { getProviderForModel } from "@/providers/llm";

/**
 * POST /api/models/test
 * Tests a custom model endpoint, custom API key, or built-in model connectivity.
 * Returns response status, latency in milliseconds, and model banner output.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { model, apiKey, apiBaseUrl, provider } = body;

    const started = Date.now();
    const testProvider = getProviderForModel(model || "gpt-4o", {
      customApiKey: apiKey,
      customApiBaseUrl: apiBaseUrl,
      customApiProvider: provider,
    });

    const completion = await testProvider.complete(
      [
        { role: "system", content: "You are a connectivity test agent. Reply with the single word: OK" },
        { role: "user", content: "ping" },
      ],
      { temperature: 0.1, maxTokens: 10, timeoutMs: 15_000 }
    );

    const latencyMs = Date.now() - started;

    return NextResponse.json({
      success: true,
      connected: true,
      latencyMs,
      model: model || testProvider.model,
      provider: testProvider.name,
      reply: completion.content.trim(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
