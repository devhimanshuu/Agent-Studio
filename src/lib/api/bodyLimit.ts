/**
 * Request body size validation.
 *
 * Next.js App Router doesn't enforce body size limits by default.
 * This helper validates the Content-Length header before parsing JSON,
 * preventing memory exhaustion from oversized payloads.
 *
 * Usage in route handlers:
 *   const bodyError = await validateBodySize(request, 1_048_576); // 1MB
 *   if (bodyError) return bodyError;
 *   const body = await request.json();
 */

import { NextResponse } from "next/server";

/** Default max body size: 1MB */
const DEFAULT_MAX_BYTES = 1_048_576;

/**
 * Validate request body size from Content-Length header.
 * Returns a 413 response if exceeded, null if OK.
 *
 * Note: Some clients (especially stream/fetch) may not send Content-Length.
 * In those cases this is a no-op — the actual parsing will still fail
 * if the body is truly oversized.
 */
export function validateBodySize(
  request: Request,
  maxBytes = DEFAULT_MAX_BYTES
): NextResponse | null {
  const contentLength = request.headers.get("content-length");

  if (!contentLength) {
    // No Content-Length header — can't validate preemptively.
    // The JSON parser will still fail if the body is malformed.
    return null;
  }

  const size = parseInt(contentLength, 10);

  if (isNaN(size)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid Content-Length header",
        code: "BAD_REQUEST",
      },
      { status: 400 }
    );
  }

  if (size > maxBytes) {
    const maxMB = (maxBytes / 1_048_576).toFixed(1);
    const actualMB = (size / 1_048_576).toFixed(1);
    return NextResponse.json(
      {
        success: false,
        error: `Request body too large (${actualMB}MB). Maximum allowed is ${maxMB}MB.`,
        code: "PAYLOAD_TOO_LARGE",
      },
      { status: 413 }
    );
  }

  return null;
}

/**
 * Safe JSON parse with body size validation.
 * Validates size first, then parses.
 */
export async function parseJsonBody<T = unknown>(
  request: Request,
  maxBytes = DEFAULT_MAX_BYTES
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  const sizeError = validateBodySize(request, maxBytes);
  if (sizeError) return { error: sizeError };

  try {
    const data = await request.json() as T;
    return { data };
  } catch {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body",
          code: "BAD_REQUEST",
        },
        { status: 400 }
      ),
    };
  }
}
