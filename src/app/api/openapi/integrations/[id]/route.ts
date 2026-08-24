import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { updateOpenApiIntegrationSchema } from "@/validators/openApiSchema";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/api/handlers";
import { ZodError } from "zod";

const { openApiService } = apiServices();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  try {
    const integration = await openApiService.getIntegration(id, userId);
    if (!integration) return notFound("OpenAPI integration not found");
    return NextResponse.json({ success: true, data: integration });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  try {
    const body = await request.json();
    const validated = updateOpenApiIntegrationSchema.parse(body);
    const updated = await openApiService.updateIntegration(id, userId, validated);
    return NextResponse.json({ success: true, data: updated });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  try {
    await openApiService.deleteIntegration(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
