import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { testRawEndpointRequestSchema } from "@/validators/openApiSchema";
import { unauthorized, handleApiError } from "@/lib/api/handlers";

const { openApiService } = apiServices();

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    const validated = testRawEndpointRequestSchema.parse(body);
    const result = await openApiService.testRawEndpoint(
      validated.endpoint,
      {
        integrationId: "preview",
        integrationName: "Preview",
        baseUrl: validated.baseUrl,
        authType: validated.authType,
        authConfig: validated.authConfig,
      },
      validated.arguments
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
