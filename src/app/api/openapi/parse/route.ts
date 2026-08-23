import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { parseSpecRequestSchema } from "@/validators/openApiSchema";
import { unauthorized, badRequest, serverError } from "@/lib/api/handlers";
import { ZodError } from "zod";

const { openApiService } = apiServices();

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    const validated = parseSpecRequestSchema.parse(body);
    const parsed = await openApiService.parseSpec({
      specUrl: validated.specUrl || undefined,
      rawSpec: validated.rawSpec,
    });

    return NextResponse.json({ success: true, data: parsed });
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
