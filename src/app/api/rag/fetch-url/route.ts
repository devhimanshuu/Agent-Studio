/**
 * POST /api/rag/fetch-url
 *
 * Fetches a web page URL, extracts clean content, and ingests into RAG.
 * Converts HTML to clean markdown for optimal RAG retrieval.
 *
 * Request body:
 *   - url: string (required) — the URL to fetch
 *   - collection: string (optional) — target collection namespace
 *   - tags: string[] (optional) — document tags
 *   - chunking: object (optional) — chunking configuration
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { defaultRAGPipeline } from "@/modules/rag";
import { ensureUserExists } from "@/lib/user";
import { logger } from "@/lib/logger";
import TurndownService from "turndown";

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5MB max page size

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserExists(userId);

    const body = await request.json();
    const {
      url,
      collection = "default",
      tags = [],
      chunking = {},
      useParentChunking = false,
      embeddingModel,
    } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Field 'url' is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Only HTTP/HTTPS URLs are supported");
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL. Must be a valid HTTP/HTTPS URL." },
        { status: 400 }
      );
    }

    logger.info({ url, userId, collection }, "Fetching URL for RAG ingestion");

    // Fetch the page
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Agent-Studio-RAG/1.0 (Knowledge Base Ingestion)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${res.status} ${res.statusText}` },
        { status: 402 }
      );
    }

    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();

    if (rawText.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Page too large (${(rawText.length / 1024 / 1024).toFixed(1)}MB). Max: 5MB.` },
        { status: 400 }
      );
    }

    // Extract title from the page
    const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch?.[1]?.trim() || deriveTitleFromUrl(parsedUrl);

    // Convert to clean markdown
    let content: string;

    if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
      const turndown = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        bulletListMarker: "-",
      });

      // Remove boilerplate
      turndown.remove(["script", "style", "nav", "footer", "header", "aside", "form"]);

      content = turndown.turndown(rawText);
    } else if (contentType.includes("text/plain") || contentType.includes("text/markdown")) {
      content = rawText;
    } else if (contentType.includes("application/json")) {
      try {
        const data = JSON.parse(rawText);
        content = formatJsonForRAG(data, pageTitle);
      } catch {
        content = rawText;
      }
    } else {
      content = rawText;
    }

    // Clean up the content
    content = cleanContent(content);

    if (!content || content.trim().length < 50) {
      return NextResponse.json(
        { error: "Page contains insufficient text content for ingestion." },
        { status: 400 }
      );
    }

    // Ingest into RAG pipeline
    const result = await defaultRAGPipeline.ingest({
      content,
      title: pageTitle,
      collection,
      source: url,
      mimeType: "text/markdown",
      chunking,
      useParentChunking:
        typeof chunking.parentChunkSize === "number" && chunking.parentChunkSize > 0
          ? true
          : useParentChunking,
      metadata: {
        url,
        fetchedAt: new Date().toISOString(),
        contentType,
        contentLength: content.length,
        tags: Array.isArray(tags) ? tags : [],
        embeddingModel: typeof embeddingModel === "string" ? embeddingModel : undefined,
      },
      userId,
    });

    return NextResponse.json({
      success: true,
      document: {
        title: pageTitle,
        url,
        chunkCount: result.chunkCount,
        totalTokens: result.totalTokens,
        documentId: result.documentId,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "URL fetch failed");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch and ingest URL",
      },
      { status: 500 }
    );
  }
}

function deriveTitleFromUrl(url: URL): string {
  const path = url.pathname
    .replace(/\/$/, "")
    .split("/")
    .filter(Boolean)
    .pop();

  if (path) {
    return path
      .replace(/[-_]/g, " ")
      .replace(/\.\w+$/, "")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return url.hostname;
}

function formatJsonForRAG(data: unknown, title: string): string {
  if (Array.isArray(data)) {
    let content = `# ${title}\n\nJSON array with ${data.length} items.\n\n`;
    const sampleSize = Math.min(data.length, 30);
    for (let i = 0; i < sampleSize; i++) {
      if (typeof data[i] === "object" && data[i] !== null) {
        content += `## Item ${i + 1}\n`;
        for (const [key, value] of Object.entries(data[i] as Record<string, unknown>)) {
          content += `- **${key}:** ${typeof value === "object" ? JSON.stringify(value) : String(value)}\n`;
        }
        content += "\n";
      }
    }
    return content;
  }

  if (typeof data === "object" && data !== null) {
    let content = `# ${title}\n\n`;
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      content += `- **${key}:** ${typeof value === "object" ? JSON.stringify(value) : String(value)}\n`;
    }
    return content;
  }

  return `# ${title}\n\n${String(data)}`;
}

function cleanContent(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}
