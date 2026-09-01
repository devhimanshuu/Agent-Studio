import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { testEndpointRequestSchema } from "@/validators/openApiSchema";
import { unauthorized, handleApiError } from "@/lib/api/handlers";

const { openApiService } = apiServices();

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
    return handleApiError(error);
  }
}
