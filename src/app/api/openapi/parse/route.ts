import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiServices } from "@/lib/api/services";

import { parseSpecRequestSchema } from "@/validators/openApiSchema";
import { unauthorized, handleApiError } from "@/lib/api/handlers";

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
    return handleApiError(error);
  }
}
