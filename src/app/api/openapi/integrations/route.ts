import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OpenApiService } from "@/services/OpenApiService";
import { OpenApiRepository } from "@/repositories/OpenApiRepository";
import { createOpenApiIntegrationSchema } from "@/validators/openApiSchema";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";
import { ZodError } from "zod";

const openApiService = new OpenApiService(new OpenApiRepository());

export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const integrations = await openApiService.listIntegrations(userId);
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
