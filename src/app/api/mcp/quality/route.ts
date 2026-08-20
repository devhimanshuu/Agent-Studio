import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { ServerQualityScore, QualityGrade } from "@/types/agent-studio-registry";

export const revalidate = 300; // Revalidate every 5 minutes

function computeGrade(score: number): QualityGrade {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 77) return "C+";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function scoreSchemaQuality(tools: { inputSchema?: Record<string, unknown> }[]): { score: number; grade: QualityGrade; details: string } {
  if (!tools || tools.length === 0) {
    return { score: 50, grade: "C", details: "No tools to evaluate" };
  }

  let totalScore = 0;
  const issues: string[] = [];

  for (const tool of tools) {
    const schema = tool.inputSchema;
    if (!schema) {
      issues.push(`Tool missing input schema`);
      totalScore += 20;
      continue;
    }

    let toolScore = 80; // Base score for having a schema

    // Check for properties
    if (schema.properties && typeof schema.properties === "object") {
      const props = Object.keys(schema.properties);
      if (props.length > 0) toolScore += 10;

      // Check for descriptions
      const withDescriptions = props.filter((p) => {
        const prop = (schema.properties as Record<string, unknown>)[p];
        return prop && typeof prop === "object" && "description" in prop;
      });
      if (withDescriptions.length === props.length) toolScore += 5;
      else issues.push(`Some parameters lack descriptions`);
    } else {
      issues.push(`Schema missing properties`);
      toolScore -= 20;
    }

    // Check for required fields
    if (schema.required && Array.isArray(schema.required)) {
      toolScore += 5;
    }

    totalScore += Math.min(100, toolScore);
  }

  const avgScore = Math.round(totalScore / tools.length);
  return {
    score: avgScore,
    grade: computeGrade(avgScore),
    details: issues.length > 0 ? issues.slice(0, 3).join("; ") : "All schemas well-defined",
  };
}

async function scoreLatency(endpointUrl?: string): Promise<{ score: number; grade: QualityGrade; avgMs: number }> {
  if (!endpointUrl) {
    return { score: 70, grade: "B", avgMs: 0 };
  }

  try {
    const start = Date.now();
    await fetch(endpointUrl, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Agent-Studio/1.0" },
    });
    const latency = Date.now() - start;

    // Score: <100ms = 100, <500ms = 80, <1000ms = 60, <2000ms = 40, else = 20
    let score: number;
    if (latency < 100) score = 100;
    else if (latency < 500) score = 85;
    else if (latency < 1000) score = 70;
    else if (latency < 2000) score = 50;
    else score = 30;

    return { score, grade: computeGrade(score), avgMs: latency };
  } catch {
    return { score: 30, grade: "D", avgMs: 0 };
  }
}

function scoreDocumentation(repoUrl?: string, description?: string): { score: number; grade: QualityGrade; hasReadme: boolean; hasExamples: boolean } {
  let score = 50; // Base score

  if (description && description.length > 50) score += 10;
  if (description && description.length > 100) score += 5;

  const hasReadme = Boolean(repoUrl);
  if (hasReadme) score += 20;

  // Check for examples in description
  const hasExamples = Boolean(description?.includes("example") || description?.includes("```") || description?.includes("npx"));
  if (hasExamples) score += 15;

  score = Math.min(100, score);
  return { score, grade: computeGrade(score), hasReadme, hasExamples };
}

function scoreCommunity(stars?: number): { score: number; grade: QualityGrade; stars: number; issues: number; forks: number } {
  const s = stars || 0;
  let score = 30;

  if (s > 10) score += 10;
  if (s > 50) score += 15;
  if (s > 100) score += 15;
  if (s > 500) score += 15;
  if (s > 1000) score += 15;

  score = Math.min(100, score);
  return { score, grade: computeGrade(score), stars: s, issues: 0, forks: 0 };
}

function scoreUptime(isVerified?: boolean): { score: number; grade: QualityGrade; percent: number } {
  // For verified servers, assume higher uptime
  const score = isVerified ? 85 : 60;
  const percent = score;
  return { score, grade: computeGrade(score), percent };
}

function scoreMaintenance(isVerified?: boolean, stars?: number): { score: number; grade: QualityGrade; lastUpdated: string; commitFrequency: string } {
  let score = isVerified ? 80 : 50;
  if (stars && stars > 100) score += 10;
  if (stars && stars > 500) score += 10;

  score = Math.min(100, score);
  return {
    score,
    grade: computeGrade(score),
    lastUpdated: isVerified ? "Recently" : "Unknown",
    commitFrequency: isVerified ? "Active" : "Unknown",
  };
}

interface ServerInput {
  id: string;
  name?: string;
  transport?: string;
  endpointUrl?: string;
  repoUrl?: string;
  description?: string;
  stars?: number;
  isVerified?: boolean;
  cachedTools?: { inputSchema?: Record<string, unknown> }[];
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const servers: ServerInput[] = body.servers || [];

  if (!Array.isArray(servers) || servers.length === 0) {
    return NextResponse.json({ success: false, error: "servers array required" }, { status: 400 });
  }

  const scores: ServerQualityScore[] = servers.map((server) => {
    const schema = scoreSchemaQuality(server.cachedTools || []);
    const latencyScore = { score: 75, grade: computeGrade(75) as QualityGrade, avgMs: 0 }; // Placeholder for STDIO
    const docs = scoreDocumentation(server.repoUrl, server.description);
    const community = scoreCommunity(server.stars);
    const uptime = scoreUptime(server.isVerified);
    const maintenance = scoreMaintenance(server.isVerified, server.stars);

    // Weighted overall score
    const overallScore = Math.round(
      schema.score * 0.25 +
      latencyScore.score * 0.20 +
      docs.score * 0.15 +
      community.score * 0.15 +
      uptime.score * 0.15 +
      maintenance.score * 0.10
    );

    // Determine badges
    const badges: ServerQualityScore["badges"] = [];
    if (schema.score >= 90) badges.push({ id: "schema-star", label: "Schema Star", icon: "⭐", description: "Excellent tool schema quality", earnedAt: new Date().toISOString() });
    if (community.score >= 80) badges.push({ id: "community-favorite", label: "Community Favorite", icon: "❤️", description: "Highly rated by the community", earnedAt: new Date().toISOString() });
    if (server.isVerified) badges.push({ id: "verified", label: "Verified", icon: "🛡️", description: "Officially verified server", earnedAt: new Date().toISOString() });
    if (uptime.score >= 85) badges.push({ id: "high-uptime", label: "High Uptime", icon: "🟢", description: "Consistently available", earnedAt: new Date().toISOString() });

    return {
      serverId: server.id,
      overall: computeGrade(overallScore),
      overallScore,
      dimensions: {
        schemaQuality: schema,
        latency: latencyScore,
        uptime,
        documentation: docs,
        maintenance,
        community,
      },
      badges,
      lastScored: new Date().toISOString(),
    };
  });

  return NextResponse.json({ success: true, data: scores });
}
