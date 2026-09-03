/**
 * File Parsers — extract text content from various file formats
 * for ingestion into the RAG pipeline.
 *
 * Supported formats:
 *   - PDF (via pdf-parse)
 *   - DOCX (via mammoth)
 *   - HTML (via turndown)
 *   - CSV (row-based extraction)
 *   - JSON (structured extraction)
 *   - Markdown / Plain Text (passthrough)
 */

import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import TurndownService from "turndown";

// ────────────── Types ──────────────

export interface ParsedFile {
  /** Extracted text content (markdown or plaintext) */
  content: string;
  /** Document title (derived from filename or metadata) */
  title: string;
  /** MIME type of the parsed content */
  mimeType: string;
  /** Original file extension */
  extension: string;
  /** Metadata extracted from the file */
  metadata: Record<string, unknown>;
}

export type SupportedExtension =
  | ".pdf"
  | ".docx"
  | ".doc"
  | ".html"
  | ".htm"
  | ".csv"
  | ".json"
  | ".txt"
  | ".md"
  | ".markdown"
  | ".xml"
  | ".yaml"
  | ".yml";

const EXTENSION_MAP: Record<string, SupportedExtension> = {
  pdf: ".pdf",
  docx: ".docx",
  doc: ".doc",
  html: ".html",
  htm: ".htm",
  csv: ".csv",
  json: ".json",
  txt: ".txt",
  md: ".md",
  markdown: ".markdown",
  xml: ".xml",
  yaml: ".yaml",
  yml: ".yml",
};

// ────────────── Public API ──────────────

/**
 * Parse a file buffer into extractable text content.
 */
export async function parseFile(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ParsedFile> {
  const ext = getExtension(filename);
  const title = deriveTitle(filename);

  switch (ext) {
    case ".pdf":
      return parsePdf(buffer, title);
    case ".docx":
    case ".doc":
      return parseDocx(buffer, title);
    case ".html":
    case ".htm":
      return parseHtml(buffer, title);
    case ".csv":
      return parseCsv(buffer, title);
    case ".json":
      return parseJson(buffer, title);
    case ".xml":
    case ".yaml":
    case ".yml":
      return parsePlainText(buffer, title, mimeType || "text/plain");
    case ".md":
    case ".markdown":
      return parsePlainText(buffer, title, "text/markdown");
    case ".txt":
    default:
      return parsePlainText(buffer, title, mimeType || "text/plain");
  }
}

/**
 * Check if a file extension is supported.
 */
export function isSupportedExtension(filename: string): boolean {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = filename.slice(lastDot + 1).toLowerCase();
  return ext in EXTENSION_MAP;
}

/**
 * Get all supported file extensions.
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}

// ────────────── PDF Parser ──────────────

async function parsePdf(buffer: Buffer, title: string): Promise<ParsedFile> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  // Build metadata from PDF info
  const metadata: Record<string, unknown> = {
    pages: result.total || 0,
  };

  // Clean up the extracted text
  const content = cleanText(result.text || "");

  return {
    content,
    title,
    mimeType: "text/markdown",
    extension: ".pdf",
    metadata,
  };
}

// ────────────── DOCX Parser ──────────────

async function parseDocx(buffer: Buffer, title: string): Promise<ParsedFile> {
  const result = await mammoth.extractRawText({ buffer });

  const content = cleanText(result.value);
  const warnings = result.messages.filter((m) => m.type === "warning");

  return {
    content,
    title,
    mimeType: "text/markdown",
    extension: ".docx",
    metadata: {
      warnings: warnings.map((w) => w.message),
    },
  };
}

// ────────────── HTML Parser ──────────────

function parseHtml(buffer: Buffer, title: string): ParsedFile {
  const html = buffer.toString("utf-8");

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Remove script and style elements
  turndown.remove(["script", "style", "nav", "footer", "header"]);

  const markdown = turndown.turndown(html);
  const content = cleanText(markdown);

  return {
    content,
    title,
    mimeType: "text/markdown",
    extension: ".html",
    metadata: {
      originalLength: html.length,
    },
  };
}

// ────────────── CSV Parser ──────────────

function parseCsv(buffer: Buffer, title: string): ParsedFile {
  const text = buffer.toString("utf-8");
  const lines = text.split("\n").filter((l) => l.trim());

  if (lines.length === 0) {
    return {
      content: "",
      title,
      mimeType: "text/plain",
      extension: ".csv",
      metadata: { rows: 0 },
    };
  }

  // Parse header row
  const headers = parseCsvRow(lines[0]);

  // Build markdown table
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(parseCsvRow(lines[i]));
  }

  // Convert to markdown table
  let content = `# ${title}\n\n`;
  content += `| ${headers.join(" | ")} |\n`;
  content += `| ${headers.map(() => "---").join(" | ")} |\n`;
  for (const row of rows) {
    // Pad row to match header count
    while (row.length < headers.length) row.push("");
    content += `| ${row.slice(0, headers.length).join(" | ")} |\n`;
  }

  return {
    content,
    title,
    mimeType: "text/markdown",
    extension: ".csv",
    metadata: {
      rows: rows.length,
      columns: headers.length,
      headers,
    },
  };
}

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

// ────────────── JSON Parser ──────────────

function parseJson(buffer: Buffer, title: string): ParsedFile {
  const text = buffer.toString("utf-8");

  try {
    const data = JSON.parse(text);

    // Convert JSON to structured markdown for better RAG retrieval
    let content = `# ${title}\n\n`;

    if (Array.isArray(data)) {
      content += `JSON array with ${data.length} items.\n\n`;
      // If it's an array of objects, create a table or list
      if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
        const keys = Object.keys(data[0]);
        content += `**Fields:** ${keys.join(", ")}\n\n`;
        // Show first 50 items as structured text
        const sampleSize = Math.min(data.length, 50);
        for (let i = 0; i < sampleSize; i++) {
          content += `### Item ${i + 1}\n`;
          content += formatJsonObject(data[i], "  ");
          content += "\n";
        }
        if (data.length > 50) {
          content += `\n... and ${data.length - 50} more items.\n`;
        }
      } else {
        // Simple array
        content += "```\n" + JSON.stringify(data, null, 2) + "\n```\n";
      }
    } else if (typeof data === "object" && data !== null) {
      content += formatJsonObject(data);
    } else {
      content += String(data);
    }

    return {
      content,
      title,
      mimeType: "text/markdown",
      extension: ".json",
      metadata: {
        type: Array.isArray(data) ? "array" : typeof data,
        size: Array.isArray(data) ? data.length : Object.keys(data).length,
      },
    };
  } catch {
    // If JSON parsing fails, treat as plain text
    return parsePlainText(buffer, title, "text/plain");
  }
}

function formatJsonObject(obj: Record<string, unknown>, indent = ""): string {
  let result = "";
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null) {
      result += `${indent}**${key}:**\n`;
      result += formatJsonObject(value as Record<string, unknown>, indent + "  ");
    } else {
      result += `${indent}- **${key}:** ${String(value)}\n`;
    }
  }
  return result;
}

// ────────────── Plain Text Parser ──────────────

function parsePlainText(
  buffer: Buffer,
  title: string,
  mimeType: string
): ParsedFile {
  const content = cleanText(buffer.toString("utf-8"));

  return {
    content,
    title,
    mimeType,
    extension: ".txt",
    metadata: {
      originalLength: buffer.length,
    },
  };
}

// ────────────── Helpers ──────────────

function getExtension(filename: string): SupportedExtension | "" {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  const ext = filename.slice(lastDot + 1).toLowerCase();
  return EXTENSION_MAP[ext] || "";
}

function deriveTitle(filename: string): string {
  // Remove extension and clean up
  const lastDot = filename.lastIndexOf(".");
  const name = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  return name
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    // Remove excessive blank lines (keep max 2)
    .replace(/\n{3,}/g, "\n\n")
    // Remove leading/trailing whitespace per line
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    // Trim overall
    .trim();
}
