/**
 * GET /api/docs — serves the OpenAPI 3.0 JSON specification.
 *
 * Consumed by Swagger UI at /docs or any OpenAPI-compatible client.
 */
import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/api/openapi";

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
