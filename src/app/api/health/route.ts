import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "agent-studio",
    timestamp: new Date().toISOString(),
  });
}
