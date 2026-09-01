import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { ForbiddenError as RbacForbiddenError, NotFoundError as RbacNotFoundError } from "@/services/RBACService";
import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} from "@/lib/api/errors";

export { isValidIsoDate } from "./dates";

type ApiError = {
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

/**
 * Unified API error handler for route catch blocks.
 * Maps known error types to the appropriate HTTP response and falls through
 * to `serverError` for anything unexpected.
 *
 * Usage:
 *   } catch (error) {
 *     return handleApiError(error);
 *   }
 */
export function handleApiError(error: unknown): NextResponse<ApiError> {
  // SyntaxError from request.json() on malformed bodies
  if (error instanceof SyntaxError) {
    return badRequest(new Error("Invalid JSON body"));
  }
  // ZodError (or anything carrying Zod-style `issues`)
  if (error instanceof Error && "issues" in error) {
    return badRequest(error);
  }
  // Shared typed API errors (preferred)
  if (error instanceof BadRequestError) {
    return badRequest(error);
  }
  if (error instanceof UnauthorizedError) {
    return unauthorized();
  }
  if (error instanceof ForbiddenError) {
    return forbidden();
  }
  if (error instanceof NotFoundError) {
    return notFound(error.message);
  }
  // Legacy RBACService error types (also typed)
  if (error instanceof RbacForbiddenError) {
    return forbidden();
  }
  if (error instanceof RbacNotFoundError) {
    return notFound(error.message);
  }
  // DEPRECATED fallback: check message substrings for ownership / not-found
  // patterns used by services that still throw plain Error. New code should
  // use NotFoundError / ForbiddenError from @/lib/api/errors instead.
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("not found") || msg.includes("not have access")) {
      return notFound(msg);
    }
    if (msg.includes("access") || msg.includes("permission")) {
      return forbidden();
    }
  }
  return serverError(error);
}

