import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLLMProvider } from "@/providers/llm";
import { unauthorized, serverError } from "@/lib/api/handlers";
import { rateLimit } from "@/lib/api/rateLimit";

const OPTIMIZER_SYSTEM_PROMPT = `You are a prompt engineering expert. Given an agent's current system prompt and its role context, produce an optimized version that:

1. **Role Framing**: Opens with a clear role declaration ("You are a [role] agent in a multi-agent system...")
2. **Input Contract**: Describes exactly what the agent receives (references like {{ results.nodeId }}, {{ input.field }})
3. **Output Contract**: Specifies the exact output format the agent should return
4. **Instructions**: Clear, numbered steps for the agent's task
5. **Constraints**: Boundary conditions and what the agent should NOT do
6. **Few-Shot Examples**: 2-3 concrete input→output examples demonstrating expected behavior

Rules:
- Preserve the original intent and domain knowledge
- Keep the prompt concise (target: 200-600 tokens)
- Use structured markdown formatting
- Reference actual node/input/result variables where applicable
- Return ONLY the optimized prompt text, no explanations or meta-commentary`;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const limited = rateLimit(`canvas:optimize:${userId}`);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { prompt, nodeType, label, condition, toolName } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { success: false, error: "Prompt text is required" },
        { status: 400 }
      );
    }

    const contextParts = [
      `Node type: ${nodeType ?? "agent"}`,
      `Node label: ${label ?? "Unknown"}`,
      condition ? `Router condition: ${condition}` : "",
      toolName ? `Tool: ${toolName}` : "",
    ].filter(Boolean);

    const userMessage = `${contextParts.join("\n")}\n\nCurrent prompt:\n${prompt}`;

    const llm = getLLMProvider();
    const llmResponse = await llm.complete(
      [
        { role: "system", content: OPTIMIZER_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.3, maxTokens: 2048 }
    );

    const optimizedPrompt = llmResponse.content.trim();

    // Estimate token improvement
    const originalTokens = Math.ceil(prompt.length / 4);
    const optimizedTokens = Math.ceil(optimizedPrompt.length / 4);

    return NextResponse.json({
      success: true,
      optimizedPrompt,
      stats: {
        originalTokens,
        optimizedTokens,
        improvement: optimizedTokens > originalTokens
          ? `+${Math.round(((optimizedTokens - originalTokens) / originalTokens) * 100)}%`
          : `${Math.round(((originalTokens - optimizedTokens) / originalTokens) * 100)}%`,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
