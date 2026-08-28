import { NextResponse } from "next/server";
import { A2AMessage } from "@/types/a2a";
import { getLLMProvider } from "@/providers/llm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const message = (await request.json()) as A2AMessage;
    const llm = getLLMProvider();

    const completion = await llm.complete([
      {
        role: "system",
        content: `You are an autonomous participant in an A2A multi-agent conversation. Sender is ${message.sender}. Provide a concise, constructive reply to advance the collective goal.`,
      },
      { role: "user", content: message.content },
    ]);

    return NextResponse.json({
      reply: completion.content,
      sender: "Agent-Studio-Node",
      turn: (message.turn ?? 0) + 1,
      timestamp: Date.now(),
    }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return NextResponse.json({
      reply: "Acknowledged A2A message.",
      sender: "Agent-Studio-Node",
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    }, { status: 200 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
