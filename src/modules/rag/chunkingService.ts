/**
 * Document Chunking Service — splits documents into optimal chunks for RAG.
 *
 * Supports industry-standard chunking strategies:
 * - Recursive Character Splitting (hierarchical separator awareness)
 * - Semantic / Sentence-Aware Chunking (sentence boundaries)
 * - Markdown-Aware Chunking (headings, code blocks, section hierarchy)
 * - Fixed-Size Chunking with configurable overlap
 * - "Small-to-Big" Parent-Document Chunking (granular indexing chunks mapped to full context parents)
 */

export interface ChunkingOptions {
  /** Maximum chunk size in characters (default: 800) */
  maxChunkSize?: number;
  /** Overlap between chunks in characters (default: 150) */
  overlap?: number;
  /** Chunking strategy */
  strategy?: "recursive" | "semantic" | "markdown" | "fixed";
  /** Separator characters for recursive/semantic chunking */
  separators?: string[];
  /** Document source name or title */
  source?: string;
  /** Whether to inject section breadcrumb into chunk embedding text */
  injectSectionHeader?: boolean;
  /** Parent chunk size for Small-to-Big retrieval (default: 1500) */
  parentChunkSize?: number;
}

export interface DocumentChunk {
  /** Unique chunk identifier */
  id: string;
  /** The chunk content for embedding and retrieval */
  content: string;
  /** Optional contextual text with prepended breadcrumbs */
  embeddingText: string;
  /** Chunk index in the document */
  index: number;
  /** Starting character position in original document */
  startOffset: number;
  /** Ending character position in original document */
  endOffset: number;
  /** Metadata about the chunk */
  metadata: {
    /** Document title or source path */
    source?: string;
    /** Chunk character count */
    charCount: number;
    /** Approximate word count */
    wordCount: number;
    /** Estimated token count */
    tokenCount: number;
    /** Section header / breadcrumb if found */
    section?: string;
    /** Parent context text for Small-to-Big retrieval */
    parentContent?: string;
    /** Parent chunk ID */
    parentId?: string;
  };
}

/**
 * Split a document into chunks optimized for embedding, vector storage, and semantic retrieval.
 */
export function chunkDocument(
  document: string,
  options: ChunkingOptions = {}
): DocumentChunk[] {
  const {
    maxChunkSize = 800,
    overlap = 150,
    strategy = "recursive",
    separators,
    source,
    injectSectionHeader = true,
  } = options;

  const text = document ? document.trim() : "";
  if (!text) {
    return [];
  }

  let chunks: DocumentChunk[];

  switch (strategy) {
    case "markdown":
      chunks = chunkMarkdown(text, maxChunkSize, overlap, source, injectSectionHeader);
      break;
    case "semantic":
      chunks = chunkSemantic(text, maxChunkSize, overlap, separators, source);
      break;
    case "fixed":
      chunks = chunkFixed(text, maxChunkSize, overlap, source);
      break;
    case "recursive":
    default:
      chunks = chunkRecursive(text, maxChunkSize, overlap, separators, source);
      break;
  }

  return chunks;
}

/**
 * "Small-to-Big" Parent-Document Chunking:
 * Generates granular child chunks (e.g. 200-300 chars) for high-accuracy embedding search,
 * with each child retaining its surrounding parent chunk (e.g. 1000-1500 chars) for LLM context expansion.
 */
export function chunkDocumentWithParent(
  document: string,
  options: ChunkingOptions = {}
): DocumentChunk[] {
  const childSize = options.maxChunkSize || 300;
  const parentSize = options.parentChunkSize || 1200;
  const overlap = options.overlap || 60;

  const text = document ? document.trim() : "";
  if (!text) return [];

  // Generate parent chunks
  const parents = chunkDocument(text, {
    maxChunkSize: parentSize,
    overlap: Math.round(overlap * 1.5),
    strategy: options.strategy || "markdown",
    source: options.source,
  });

  const allChildren: DocumentChunk[] = [];
  let childIndex = 0;

  for (let pIdx = 0; pIdx < parents.length; pIdx++) {
    const parent = parents[pIdx];
    const parentId = `parent_${pIdx}_${parent.startOffset}`;

    // Sub-chunk the parent into granular children
    const rawChildren = chunkDocument(parent.content, {
      maxChunkSize: childSize,
      overlap,
      strategy: "recursive",
      source: options.source,
    });

    for (const child of rawChildren) {
      allChildren.push({
        ...child,
        id: `child_${childIndex}_${parent.startOffset + child.startOffset}`,
        index: childIndex,
        startOffset: parent.startOffset + child.startOffset,
        endOffset: parent.startOffset + child.endOffset,
        metadata: {
          ...child.metadata,
          section: parent.metadata.section,
          parentId,
          parentContent: parent.content,
        },
      });
      childIndex++;
    }
  }

  return allChildren;
}

/**
 * Recursive character splitter — splits on hierarchy of separators:
 * ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""]
 */
function chunkRecursive(
  text: string,
  maxChunkSize: number,
  overlap: number,
  customSeparators?: string[],
  source?: string
): DocumentChunk[] {
  const separators = customSeparators ?? ["\n\n", "\n", ". ", "! ", "? ", "; ", " ", ""];
  const rawPieces = splitRecursively(text, maxChunkSize, separators);

  // Group pieces into chunks with overlap
  const chunks: DocumentChunk[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;
  let globalOffset = 0;

  for (let i = 0; i < rawPieces.length; i++) {
    const piece = rawPieces[i];
    const pieceLen = piece.length;

    if (currentLength + pieceLen > maxChunkSize && currentChunk.length > 0) {
      const content = currentChunk.join("").trim();
      if (content) {
        chunks.push(createChunk(content, chunkIndex, globalOffset, globalOffset + content.length, source));
        chunkIndex++;
      }

      // Calculate overlap pieces
      let overlapLen = 0;
      const overlapPieces: string[] = [];
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        if (overlapLen + currentChunk[j].length <= overlap) {
          overlapPieces.unshift(currentChunk[j]);
          overlapLen += currentChunk[j].length;
        } else {
          break;
        }
      }

      globalOffset += currentLength - overlapLen;
      currentChunk = overlapPieces;
      currentLength = overlapLen;
    }

    currentChunk.push(piece);
    currentLength += pieceLen;
  }

  if (currentChunk.length > 0) {
    const content = currentChunk.join("").trim();
    if (content) {
      chunks.push(createChunk(content, chunkIndex, globalOffset, globalOffset + content.length, source));
    }
  }

  return chunks;
}

function splitRecursively(text: string, maxChunkSize: number, separators: string[]): string[] {
  if (text.length <= maxChunkSize || separators.length === 0) {
    return [text];
  }

  const [separator, ...remainingSeparators] = separators;
  const parts = separator === "" ? text.split("") : text.split(separator);
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const pieceWithSep = i < parts.length - 1 && separator !== "" ? part + separator : part;

    if (pieceWithSep.length > maxChunkSize && remainingSeparators.length > 0) {
      result.push(...splitRecursively(pieceWithSep, maxChunkSize, remainingSeparators));
    } else {
      result.push(pieceWithSep);
    }
  }

  return result;
}

/**
 * Fixed-size chunking with overlap.
 */
function chunkFixed(
  text: string,
  maxChunkSize: number,
  overlap: number,
  source?: string
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    const content = text.slice(start, end).trim();

    if (content) {
      chunks.push(createChunk(content, index, start, end, source));
      index++;
    }

    start += Math.max(1, maxChunkSize - overlap);
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Semantic chunking — splits cleanly at sentence boundaries.
 */
function chunkSemantic(
  text: string,
  maxChunkSize: number,
  overlap: number,
  separators?: string[],
  source?: string
): DocumentChunk[] {
  const defaultSeparators = ["\n\n", "\n", ". ", "! ", "? ", "; "];
  const seps = separators ?? defaultSeparators;

  const chunks: DocumentChunk[] = [];
  let remaining = text;
  let globalOffset = 0;
  let index = 0;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(createChunk(remaining.trim(), index, globalOffset, globalOffset + remaining.length, source));
      break;
    }

    let splitPos = -1;
    for (const sep of seps) {
      const pos = remaining.lastIndexOf(sep, maxChunkSize);
      if (pos > maxChunkSize * 0.3) {
        splitPos = pos + sep.length;
        break;
      }
    }

    if (splitPos === -1) {
      splitPos = maxChunkSize;
    }

    const content = remaining.slice(0, splitPos).trim();
    if (content) {
      chunks.push(createChunk(content, index, globalOffset, globalOffset + splitPos, source));
      index++;
    }

    const advance = Math.max(1, splitPos - Math.min(overlap, Math.floor(splitPos * 0.3)));
    remaining = remaining.slice(advance);
    globalOffset += advance;
  }

  return chunks;
}

/**
 * Markdown-aware chunking — respects H1-H6 headers, code blocks, and retains section hierarchy.
 */
function chunkMarkdown(
  text: string,
  maxChunkSize: number,
  overlap: number,
  source?: string,
  injectSectionHeader: boolean = true
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const lines = text.split("\n");
  let currentChunk: string[] = [];
  const headingStack: string[] = [];
  let currentSection = "";
  let charOffset = 0;
  let chunkIndex = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      // Maintain heading stack
      while (headingStack.length >= level) {
        headingStack.pop();
      }
      headingStack.push(title);
      currentSection = headingStack.join(" > ");

      // Flush prior chunk before section change if it has content
      if (currentChunk.length > 0) {
        const content = currentChunk.join("\n").trim();
        if (content) {
          chunks.push(
            createChunk(content, chunkIndex, charOffset - content.length, charOffset, source, currentSection, injectSectionHeader)
          );
          chunkIndex++;
        }
        currentChunk = [];
      }
    }

    currentChunk.push(line);
    charOffset += line.length + 1;

    const currentSize = currentChunk.join("\n").length;
    if (currentSize >= maxChunkSize) {
      const content = currentChunk.join("\n").trim();
      if (content) {
        chunks.push(
          createChunk(content, chunkIndex, charOffset - currentSize, charOffset, source, currentSection, injectSectionHeader)
        );
        chunkIndex++;
      }

      // Overlap lines
      const overlapLines: string[] = [];
      let overlapSize = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        if (overlapSize + currentChunk[i].length > overlap) break;
        overlapLines.unshift(currentChunk[i]);
        overlapSize += currentChunk[i].length + 1;
      }
      currentChunk = overlapLines;
    }
  }

  const lastContent = currentChunk.join("\n").trim();
  if (lastContent) {
    chunks.push(
      createChunk(lastContent, chunkIndex, charOffset - lastContent.length, charOffset, source, currentSection, injectSectionHeader)
    );
  }

  return chunks;
}

/**
 * Create a DocumentChunk with full metadata and embedding context text.
 */
function createChunk(
  content: string,
  index: number,
  startOffset: number,
  endOffset: number,
  source?: string,
  section?: string,
  injectSectionHeader: boolean = false
): DocumentChunk {
  const words = content.split(/\s+/).filter(Boolean);
  const tokenCount = estimateTokens(content);

  const embeddingText =
    injectSectionHeader && section
      ? `[Section: ${section}]\n${content}`
      : content;

  return {
    id: `chunk-${index}-${startOffset}`,
    content,
    embeddingText,
    index,
    startOffset: Math.max(0, startOffset),
    endOffset: Math.max(startOffset, endOffset),
    metadata: {
      source,
      charCount: content.length,
      wordCount: words.length,
      tokenCount,
      section: section || undefined,
    },
  };
}

/**
 * Merge small chunks that fall below the minimum threshold to avoid fragmented vectors.
 *
 * Edge cases:
 * - Empty / single-chunk input is returned as-is.
 * - Whitespace-only chunks are dropped (otherwise they'd produce empty
 *   embeddings downstream).
 * - Each merge increments `metadata.tokenCount` and recomputes `charCount`.
 */
export function mergeSmallChunks(
  chunks: DocumentChunk[],
  minSize: number = 150
): DocumentChunk[] {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  if (chunks.length === 1) return chunks.slice();

  const merged: DocumentChunk[] = [];
  let current = chunks[0];

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i];

    if (!next || typeof next.content !== "string") continue;

    if (current.content.length < minSize) {
      const trimmed = next.content.trim();
      // Skip purely-empty neighbor so we don't bloat the merged chunk with
      // whitespace.
      if (trimmed.length === 0) continue;

      const newContent = `${current.content}\n\n${trimmed}`;
      current = {
        ...current,
        content: newContent,
        embeddingText: `${current.embeddingText}\n\n${next.embeddingText || trimmed}`,
        endOffset: next.endOffset,
        metadata: {
          ...current.metadata,
          charCount: newContent.length,
          wordCount: current.metadata.wordCount + next.metadata.wordCount,
          tokenCount: estimateTokens(newContent),
          parentContent: current.metadata.parentContent || next.metadata.parentContent,
          parentId: current.metadata.parentId || next.metadata.parentId,
        },
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Fast accurate token estimator (1 token ≈ 4 English characters or 0.75 words).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  return Math.max(1, Math.round((words * 1.3 + chars / 4) / 2));
}

/**
 * Chunk visualizer helper for UI inspection.
 */
export function previewChunks(document: string, options: ChunkingOptions = {}) {
  const chunks = mergeSmallChunks(chunkDocument(document, options));
  const totalTokens = chunks.reduce((acc, c) => acc + c.metadata.tokenCount, 0);
  const totalChars = document.length;
  const totalWords = document.split(/\s+/).filter(Boolean).length;

  return {
    chunks,
    stats: {
      chunkCount: chunks.length,
      totalChars,
      totalWords,
      totalTokens,
      avgChunkChars: chunks.length ? Math.round(totalChars / chunks.length) : 0,
      avgChunkTokens: chunks.length ? Math.round(totalTokens / chunks.length) : 0,
    },
  };
}
