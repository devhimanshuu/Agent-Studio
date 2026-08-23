import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { createOpenApiIntegrationSchema } from "@/validators/openApiSchema";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";
import { ZodError } from "zod";

const { openApiService } = apiServices();

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    // Optional ?limit= (1–200, default uncapped for the hub's own use).
    const limitRaw = new URL(request.url).searchParams.get("limit");
    const limit = limitRaw && /^\d+$/.test(limitRaw) ? Math.min(Number(limitRaw), 200) : undefined;
    const integrations = await openApiService.listIntegrations(userId, limit);
    return NextResponse.json({ success: true, data: integrations });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    const validated = createOpenApiIntegrationSchema.parse({ ...body, userId });
    const integration = await openApiService.createIntegration(validated);
    return NextResponse.json({ success: true, data: integration }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof ZodError || (error instanceof Error && (error.name === "ZodError" || "issues" in error))) {
      return badRequest(error);
    }
    return serverError(error);
  }
}
