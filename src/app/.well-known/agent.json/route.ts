import { NextResponse } from "next/server";
import { GET as getManifest } from "@/app/api/a2a/manifest/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return getManifest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
