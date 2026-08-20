import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { fetchGitHub } from "@/lib/fetch-utils";

export const revalidate = 3600;

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body?: string;
  html_url: string;
}

interface GitHubReadme {
  content: string;
  encoding: string;
}

function decodeBase64(content: string): string {
  try {
    return atob(content.replace(/\n/g, ""));
  } catch {
    return content;
  }
}

function extractOwnerRepo(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const repoUrl = searchParams.get("repo");

  if (!repoUrl) {
    return NextResponse.json({ success: false, error: "repo parameter required" }, { status: 400 });
  }

  const parsed = extractOwnerRepo(repoUrl);
  if (!parsed) {
    return NextResponse.json({ success: false, error: "Invalid GitHub repo URL" }, { status: 400 });
  }

  const { owner, repo } = parsed;
  // Fetch release and README in parallel with retry
  const [release, readmeData] = await Promise.all([
    fetchGitHub<GitHubRelease | null>(
      `/repos/${owner}/${repo}/releases/latest`,
      null
    ),
    fetchGitHub<GitHubReadme | null>(
      `/repos/${owner}/${repo}/readme`,
      null
    ),
  ]);

  const readme = readmeData
    ? readmeData.encoding === "base64"
      ? decodeBase64(readmeData.content)
      : readmeData.content
    : null;

  return NextResponse.json({
    success: true,
    data: {
      release: release
        ? {
            version: release.tag_name,
            name: release.name,
            publishedAt: release.published_at,
            body: release.body,
            url: release.html_url,
          }
        : null,
      readme,
    },
  });
}
