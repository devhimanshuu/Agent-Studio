/**
 * POST /api/rag/upload
 *
 * Accepts multipart file uploads and ingests them into the RAG pipeline.
 * Supports: PDF, DOCX, HTML, CSV, JSON, TXT, MD, XML, YAML.
 * Also supports bulk upload (multiple files at once).
 *
 * Request: multipart/form-data with fields:
 *   - file(s): one or more files
 *   - collection: target collection namespace (default: "default")
 *   - tags: comma-separated tags (optional)
 *   - embeddingModel: embedding model to use (optional)
 *   - chunking: JSON string with chunking config (optional)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { defaultRAGPipeline } from "@/modules/rag";
import { ensureUserExists } from "@/lib/user";
import { logger } from "@/lib/logger";
import { parseFile, isSupportedExtension } from "@/modules/rag/fileParsers";

export const dynamic = "force-dynamic";

/** Max file size: 20MB */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Max files per bulk upload */
const MAX_FILES = 20;

interface UploadResult {
  filename: string;
  title: string;
  status: "success" | "error";
  documentId?: string;
  chunkCount?: number;
  totalTokens?: number;
  error?: string;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserExists(userId);

    const formData = await request.formData();
    const collection = (formData.get("collection") as string) || "default";
    const tagsRaw = (formData.get("tags") as string) || "";
    const embeddingModel = (formData.get("embeddingModel") as string) || undefined;
    const chunkingRaw = (formData.get("chunking") as string) || undefined;

    // Parse optional chunking config
    let chunkingConfig: Record<string, unknown> = {};
    if (chunkingRaw) {
      try {
        chunkingConfig = JSON.parse(chunkingRaw);
      } catch {
        // Ignore invalid JSON
      }
    }

    // Parse tags
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Collect all files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && key === "file") {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files uploaded. Send files with field name 'file'." },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_FILES} files per upload.` },
        { status: 400 }
      );
    }

    logger.info(
      { userId, collection, fileCount: files.length, tags },
      "Processing file upload"
    );

    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await processFile(file, userId, collection, tags, chunkingConfig, embeddingModel);
      results.push(result);
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: files.length,
        success: successCount,
        errors: errorCount,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "File upload failed");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}

async function processFile(
  file: File,
  userId: string,
  collection: string,
  tags: string[],
  chunkingConfig: Record<string, unknown>,
  embeddingModel?: string
): Promise<UploadResult> {
  const filename = file.name;

  try {
    // Validate file extension
    if (!isSupportedExtension(filename)) {
      return {
        filename,
        title: filename,
        status: "error",
        error: `Unsupported file type. Supported: PDF, DOCX, HTML, CSV, JSON, TXT, MD, XML, YAML.`,
      };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        filename,
        title: filename,
        status: "error",
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size: 20MB.`,
      };
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse file to extract text content
    const parsed = await parseFile(buffer, filename, file.type);

    if (!parsed.content || parsed.content.trim().length === 0) {
      return {
        filename,
        title: parsed.title,
        status: "error",
        error: "File contains no extractable text content.",
      };
    }

    // Ingest into RAG pipeline
    const result = await defaultRAGPipeline.ingest({
      content: parsed.content,
      title: parsed.title,
      collection,
      source: filename,
      mimeType: parsed.mimeType,
      chunking: chunkingConfig,
      metadata: {
        ...parsed.metadata,
        tags,
        originalFilename: filename,
        originalSize: file.size,
        embeddingModel,
      },
      userId,
      // The chunker reads `parentChunkSize` from the chunking options; we
      // treat its existence as the parent's "use me" signal — matching the
      // behavior of the dashboard's manual ingest form.
      useParentChunking:
        typeof chunkingConfig.parentChunkSize === "number" && chunkingConfig.parentChunkSize > 0,
    });

    return {
      filename,
      title: parsed.title,
      status: "success",
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      totalTokens: result.totalTokens,
    };
  } catch (error) {
    logger.error({ filename, err: error }, "Failed to process file");
    return {
      filename,
      title: filename,
      status: "error",
      error: error instanceof Error ? error.message : "Processing failed",
    };
  }
}
