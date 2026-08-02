import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export type ApiError = {
  success: false;
  error: string;
  code?: string;
  fields?: Record<string, string[]>;
};

export function unauthorized(): NextResponse<ApiError> {
  return NextResponse.json(
    { success: false, error: "Authentication required", code: "UNAUTHENTICATED" },
    { status: 401 }
  );
}

export function forbidden(): NextResponse<ApiError> {
  return NextResponse.json(
    { success: false, error: "You do not have access to this resource", code: "FORBIDDEN" },
    { status: 403 }
  );
}

export function notFound(message = "Resource not found"): NextResponse<ApiError> {
  return NextResponse.json({ success: false, error: message, code: "NOT_FOUND" }, { status: 404 });
}

export function badRequest(error: unknown): NextResponse<ApiError> {
  if (error instanceof Error && "issues" in error) {
    // ZodError
    const issues = (error as { issues: { path: (string | number)[]; message: string }[] }).issues;
    const fields: Record<string, string[]> = {};
    for (const issue of issues) {
      const key = issue.path.join(".");
      fields[key] = [...(fields[key] ?? []), issue.message];
    }
    return NextResponse.json(
      { success: false, error: "Validation failed", code: "VALIDATION_ERROR", fields },
      { status: 400 }
    );
  }
  const message = error instanceof Error ? error.message : "Invalid request";
  return NextResponse.json({ success: false, error: message, code: "BAD_REQUEST" }, { status: 400 });
}

export function serverError(error: unknown): NextResponse<ApiError> {
  // Log the real error for diagnostics but never leak internal messages
  // (Prisma/SQL details, stack traces, internal paths) to API clients.
  logger.error({ err: error }, "API error");
  return NextResponse.json(
    { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

