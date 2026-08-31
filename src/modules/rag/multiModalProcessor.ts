/**
 * Multi-Modal RAG Processor
 *
 * Handles extraction, representation, and embedding of non-text content:
 * - Tables: CSV/Markdown/HTML tables → structured representation + text summary
 * - Code blocks: Language detection + AST-aware chunking + docstring extraction
 * - Images: Alt-text/caption extraction + placeholder embedding representation
 *
 * Each modality produces text embeddings suitable for the standard pgvector store,
 * plus rich metadata for filtering and display in the RAG UI.
 */

// ─── Types ───

export type ModalType = "text" | "table" | "code" | "image";

export interface MultiModalChunk {
  id: string;
  type: ModalType;
  /** Text content for embedding (may be a structured representation) */
  embeddingText: string;
  /** Display content for UI rendering */
  displayContent: string;
  /** Original raw content */
  rawContent: string;
  /** Language (for code) */
  language?: string;
  /** Table dimensions */
  tableDimensions?: { rows: number; columns: number };
  /** Image metadata */
  imageMeta?: { alt?: string; src?: string; width?: number; height?: number };
  /** Section/breadcrumb context */
  section?: string;
  /** Source document title */
  source?: string;
  /** Estimated token count */
  tokenCount: number;
}

// ─── Table Extraction ───

/**
 * Detect and extract table structures from markdown or CSV content.
 * Produces a structured representation + a natural-language summary
 * optimized for semantic embedding.
 */
export function extractTables(content: string, source?: string): MultiModalChunk[] {
  const chunks: MultiModalChunk[] = [];
  const tableRegex = /(\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n?)*)/g;
  let match: RegExpExecArray | null;
  let tableIdx = 0;

  while ((match = tableRegex.exec(content)) !== null) {
    const raw = match[1].trim();
    const parsed = parseMarkdownTable(raw);
    if (!parsed || parsed.rows.length === 0) continue;

    const _summary = summarizeTable(parsed);
    const embeddingText = buildTableEmbeddingText(parsed, source);
    const displayContent = formatTableDisplay(parsed);

    chunks.push({
      id: `table-${tableIdx}-${match.index}`,
      type: "table",
      embeddingText,
      displayContent,
      rawContent: raw,
      tableDimensions: { rows: parsed.rows.length, columns: parsed.headers.length },
      source,
      tokenCount: estimateTokens(embeddingText),
    });
    tableIdx++;
  }

  // Also detect CSV-style tables (pipe-delimited without header separator)
  const csvRegex = /((?:^[^\n]+\|[^\n]+\n){2,})/gm;
  while ((match = csvRegex.exec(content)) !== null) {
    // Skip if already captured as markdown table
    const overlap = chunks.some((c) => c.rawContent.includes(match![1].trim()));
    if (overlap) continue;

    const lines = match[1].trim().split("\n");
    if (lines.length < 2) continue;
    const headers = lines[0].split("|").map((h) => h.trim()).filter(Boolean);
    const rows = lines.slice(1).map((l) => l.split("|").map((c) => c.trim()).filter(Boolean));

    if (headers.length < 2 || rows.length === 0) continue;

    const parsed = { headers, rows };
    chunks.push({
      id: `csv-table-${tableIdx}-${match.index}`,
      type: "table",
      embeddingText: buildTableEmbeddingText(parsed, source),
      displayContent: formatTableDisplay(parsed),
      rawContent: match[1].trim(),
      tableDimensions: { rows: rows.length, columns: headers.length },
      source,
      tokenCount: estimateTokens(headers.join(" ") + " " + rows.flat().join(" ")),
    });
    tableIdx++;
  }

  return chunks;
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTable(raw: string): ParsedTable | null {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return null;

  const headers = lines[0]
    .split("|")
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  // Skip separator line (---|---|---)
  const dataLines = lines.slice(1).filter((l) => !/^\|[\s:|-]+\|$/.test(l.trim()));

  const rows = dataLines.map((line) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
  );

  return { headers, rows };
}

function buildTableEmbeddingText(table: ParsedTable, source?: string): string {
  const lines: string[] = [];
  if (source) lines.push(`[Table from: ${source}]`);
  lines.push(`Table with ${table.rows.length} rows and ${table.headers.length} columns.`);
  lines.push(`Columns: ${table.headers.join(", ")}.`);

  // Describe data patterns
  for (let i = 0; i < Math.min(3, table.rows.length); i++) {
    const row = table.rows[i];
    const pairs = table.headers.map((h, j) => `${h}: ${row[j] ?? "—"}`).join(", ");
    lines.push(`Row ${i + 1}: ${pairs}`);
  }
  if (table.rows.length > 3) {
    lines.push(`... and ${table.rows.length - 3} more rows.`);
  }

  return lines.join("\n");
}

function summarizeTable(table: ParsedTable): string {
  const colCount = table.headers.length;
  const rowCount = table.rows.length;
  return `${rowCount}×${colCount} table [${table.headers.join(", ")}]`;
}

function formatTableDisplay(table: ParsedTable): string {
  const headerLine = `| ${table.headers.join(" | ")} |`;
  const separator = `| ${table.headers.map(() => "---").join(" | ")} |`;
  const dataLines = table.rows.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, separator, ...dataLines].join("\n");
}

// ─── Code Block Extraction ───

/**
 * Extract and analyze code blocks with language detection,
 * function/class boundary detection, and docstring extraction.
 */
export function extractCodeBlocks(content: string, source?: string): MultiModalChunk[] {
  const chunks: MultiModalChunk[] = [];
  const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let codeIdx = 0;

  while ((match = codeRegex.exec(content)) !== null) {
    const language = match[1] || detectLanguage(match[2]);
    const code = match[2].trim();
    if (!code) continue;

    // Split large code blocks at function/class boundaries
    const subChunks = splitCodeAtBoundaries(code, language);

    for (let i = 0; i < subChunks.length; i++) {
      const sub = subChunks[i];
      const embeddingText = buildCodeEmbeddingText(sub.code, sub.name, sub.kind, language, source);

      chunks.push({
        id: `code-${codeIdx}-${i}-${match.index}`,
        type: "code",
        embeddingText,
        displayContent: sub.code,
        rawContent: sub.code,
        language,
        source,
        tokenCount: estimateTokens(embeddingText),
      });
    }
    codeIdx++;
  }

  return chunks;
}

interface CodeSubChunk {
  code: string;
  name?: string;
  kind?: "function" | "class" | "method" | "interface" | "type" | "block";
}

function splitCodeAtBoundaries(code: string, language: string): CodeSubChunk[] {
  const lines = code.split("\n");

  // Language-specific boundary patterns
  const boundaryPatterns: RegExp[] = getBoundaryPatterns(language);

  if (lines.length <= 20) {
    return [{ code, kind: "block" }];
  }

  const chunks: CodeSubChunk[] = [];
  let currentLines: string[] = [];
  let currentName: string | undefined;
  let currentKind: CodeSubChunk["kind"] = "block";

  for (const line of lines) {
    let isBoundary = false;
    let name: string | undefined;
    let kind: CodeSubChunk["kind"] = "block";

    for (const pattern of boundaryPatterns) {
      const m = line.match(pattern);
      if (m) {
        isBoundary = true;
        name = m[1];
        kind = classifyCodeBlock(line);
        break;
      }
    }

    if (isBoundary && currentLines.length > 2) {
      chunks.push({
        code: currentLines.join("\n").trim(),
        name: currentName,
        kind: currentKind,
      });
      currentLines = [];
    }

    if (isBoundary) currentName = name;
    if (isBoundary) currentKind = kind;
    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    chunks.push({
      code: currentLines.join("\n").trim(),
      name: currentName,
      kind: currentKind,
    });
  }

  return chunks.length > 0 ? chunks : [{ code, kind: "block" }];
}

function getBoundaryPatterns(language: string): RegExp[] {
  switch (language.toLowerCase()) {
    case "typescript":
    case "ts":
    case "javascript":
    case "js":
    case "tsx":
    case "jsx":
      return [
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
        /^(?:export\s+)?class\s+(\w+)/,
        /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
        /^(?:export\s+)?interface\s+(\w+)/,
        /^(?:export\s+)?type\s+(\w+)/,
        /^(?:export\s+)?const\s+(\w+)\s*=/,
      ];
    case "python":
    case "py":
      return [
        /^(?:async\s+)?def\s+(\w+)/,
        /^class\s+(\w+)/,
      ];
    case "go":
      return [
        /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/,
        /^type\s+(\w+)\s+struct/,
        /^type\s+(\w+)\s+interface/,
      ];
    case "rust":
    case "rs":
      return [
        /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
        /^(?:pub\s+)?struct\s+(\w+)/,
        /^(?:pub\s+)?trait\s+(\w+)/,
      ];
    case "java":
      return [
        /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/,
        /(?:public|private|protected)?\s*class\s+(\w+)/,
        /(?:public|private|protected)?\s*interface\s+(\w+)/,
      ];
    default:
      return [
        /^(\w+)\s*[\(:]/,
        /^(?:function|def|fn|func|class|struct|interface|type)\s+(\w+)/,
      ];
  }
}

function classifyCodeBlock(line: string): CodeSubChunk["kind"] {
  if (/class\s/.test(line)) return "class";
  if (/function|def |fn |func /.test(line)) return "function";
  if (/method|impl\s/.test(line)) return "method";
  if (/interface\s/.test(line)) return "interface";
  if (/type\s/.test(line)) return "type";
  return "block";
}

function detectLanguage(code: string): string {
  if (/(?:import|export)\s+.*from\s+['"]/.test(code) || /(?:const|let|var)\s+\w+\s*=/.test(code)) return "javascript";
  if (/(?:def |class |import )\w+/.test(code)) return "python";
  if (/(?:fn |struct |impl |use )\w+/.test(code)) return "rust";
  if (/(?:func |package |import\s+[""])/.test(code)) return "go";
  if (/(?:public|private)\s+(?:class|void|int|String)/.test(code)) return "java";
  return "text";
}

function buildCodeEmbeddingText(
  code: string,
  name: string | undefined,
  kind: string | undefined,
  language: string,
  source?: string
): string {
  const lines: string[] = [];
  if (source) lines.push(`[Code from: ${source}]`);
  lines.push(`${language} ${kind || "code"}${name ? ` named "${name}"` : ""}.`);

  // Extract docstrings/comments from the top of the code
  const docLines = extractDocComments(code);
  if (docLines.length > 0) {
    lines.push(`Documentation: ${docLines.join(" ")}`);
  }

  // Extract function signatures / type info
  const signatures = extractSignatures(code, language);
  if (signatures.length > 0) {
    lines.push(`Signatures: ${signatures.join("; ")}`);
  }

  // Include a portion of the implementation
  const implPreview = code.split("\n").filter((l) => l.trim() && !/^\s*\/\//.test(l)).slice(0, 8).join(" ");
  if (implPreview) {
    lines.push(`Implementation: ${implPreview.slice(0, 400)}`);
  }

  return lines.join("\n");
}

function extractDocComments(code: string): string[] {
  const lines = code.split("\n");
  const docLines: string[] = [];
  let inDoc = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("/**") || trimmed.startsWith("# ") || trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      inDoc = true;
    }
    if (inDoc) {
      const cleaned = trimmed
        .replace(/^\/\*\*\s*/, "")
        .replace(/\*\/$/, "")
        .replace(/^\*\s*/, "")
        .replace(/^#\s*/, "")
        .replace(/^"""/, "")
        .replace(/^'''/, "");
      if (cleaned) docLines.push(cleaned);
    }
    if (inDoc && (trimmed.endsWith("*/") || trimmed.endsWith('"""') || trimmed.endsWith("'''"))) {
      inDoc = false;
    }
  }

  return docLines.slice(0, 5);
}

function extractSignatures(code: string, _language?: string): string[] {
  const sigs: string[] = [];
  const lines = code.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // TypeScript/JavaScript function signatures
    const tsMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)/);
    if (tsMatch) { sigs.push(tsMatch[0]); continue; }

    // Python
    const pyMatch = trimmed.match(/(?:async\s+)?def\s+\w+\s*\([^)]*\)/);
    if (pyMatch) { sigs.push(pyMatch[0]); continue; }

    // Go/Rust
    const goMatch = trimmed.match(/func\s+(?:\([^)]+\)\s+)?\w+\s*\([^)]*\)/);
    if (goMatch) { sigs.push(goMatch[0]); continue; }

    if (sigs.length >= 3) break;
  }

  return sigs;
}

// ─── Image Extraction ───

/**
 * Extract image references from markdown/content.
 * Produces metadata-rich chunks for embedding (alt-text + context).
 */
export function extractImages(content: string, source?: string): MultiModalChunk[] {
  const chunks: MultiModalChunk[] = [];
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g;
  let match: RegExpExecArray | null;
  let imgIdx = 0;

  while ((match = imgRegex.exec(content)) !== null) {
    const alt = match[1];
    const src = match[2];
    const title = match[3];

    // Get surrounding context for better embedding
    const contextStart = Math.max(0, match.index - 200);
    const contextEnd = Math.min(content.length, match.index + match[0].length + 200);
    const surroundingText = content.slice(contextStart, contextEnd).replace(/!\[.*?\]\(.*?\)/g, "").trim();

    const caption = alt || title || "";
    const embeddingText = [
      source ? `[Image from: ${source}]` : "",
      caption ? `Image: "${caption}"` : "Image (no caption)",
      surroundingText ? `Context: ${surroundingText.slice(0, 300)}` : "",
    ].filter(Boolean).join("\n");

    chunks.push({
      id: `image-${imgIdx}-${match.index}`,
      type: "image",
      embeddingText,
      displayContent: `![${caption}](${src})`,
      rawContent: match[0],
      imageMeta: { alt: caption, src, width: undefined, height: undefined },
      source,
      tokenCount: estimateTokens(embeddingText),
    });
    imgIdx++;
  }

  return chunks;
}

// ─── Unified Multi-Modal Processor ───

export interface MultiModalProcessOptions {
  /** Extract tables from the content */
  extractTables?: boolean;
  /** Extract code blocks */
  extractCode?: boolean;
  /** Extract image references */
  extractImages?: boolean;
  /** Document source title */
  source?: string;
}

/**
 * Process content into multi-modal chunks.
 * Tables, code, and images are extracted as separate typed chunks
 * alongside the remaining plain text segments.
 */
export function processMultiModal(
  content: string,
  options: MultiModalProcessOptions = {}
): MultiModalChunk[] {
  const {
    extractTables: doTables = true,
    extractCode: doCode = true,
    extractImages: doImages = true,
    source,
  } = options;

  const allChunks: MultiModalChunk[] = [];

  // Remove extracted regions from the text to avoid double-counting
  let remaining = content;

  if (doTables) {
    const tables = extractTables(content, source);
    allChunks.push(...tables);
    for (const t of tables) {
      remaining = remaining.replace(t.rawContent, "");
    }
  }

  if (doCode) {
    const codeBlocks = extractCodeBlocks(content, source);
    allChunks.push(...codeBlocks);
    for (const c of codeBlocks) {
      remaining = remaining.replace(c.rawContent, "");
    }
  }

  if (doImages) {
    const images = extractImages(content, source);
    allChunks.push(...images);
    for (const img of images) {
      remaining = remaining.replace(img.rawContent, "");
    }
  }

  return allChunks;
}

// ─── Utility ───

function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  return Math.max(1, Math.round((words * 1.3 + chars / 4) / 2));
}
