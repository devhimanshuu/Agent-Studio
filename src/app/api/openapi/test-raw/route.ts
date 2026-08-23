import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { testRawEndpointRequestSchema } from "@/validators/openApiSchema";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";
import { ZodError } from "zod";

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
    if (error instanceof SyntaxError) {
      return badRequest(new Error("Invalid JSON body"));
    }
    if (error instanceof ZodError || (error instanceof Error && (error.name === "ZodError" || "issues" in error))) {
      return badRequest(error);
    }
    return serverError(error);
  }
}
