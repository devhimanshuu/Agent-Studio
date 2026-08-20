import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OpenApiService } from "@/services/OpenApiService";
import { OpenApiRepository } from "@/repositories/OpenApiRepository";
import { testEndpointRequestSchema } from "@/validators/openApiSchema";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";
import { ZodError } from "zod";

const openApiService = new OpenApiService(new OpenApiRepository());

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  try {
    const body = await request.json();
    const validated = testEndpointRequestSchema.parse(body);
    const result = await openApiService.testEndpoint(
      id,
      userId,
      validated.operationId,
      validated.arguments
    );

    return NextResponse.json({ success: true, data: result });
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
