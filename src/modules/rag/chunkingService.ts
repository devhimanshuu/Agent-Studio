/**
 * Document Chunking Service — splits documents into optimal chunks for RAG.
 *
 * Supports multiple chunking strategies:
 * - Fixed-size chunks with overlap
 * - Semantic chunking (sentence-aware)
 * - Markdown-aware chunking
 */

export interface ChunkingOptions {
  /** Maximum chunk size in characters */
  maxChunkSize?: number;
  /** Overlap between chunks in characters */
  overlap?: number;
  /** Chunking strategy */
  strategy?: "fixed" | "semantic" | "markdown";
  /** Separator characters for semantic chunking */
  separators?: string[];
}

export interface DocumentChunk {
  /** Unique chunk identifier */
  id: string;
  /** The chunk content */
  content: string;
  /** Chunk index in the document */
  index: number;
  /** Starting character position in original document */
  startOffset: number;
  /** Ending character position in original document */
  endOffset: number;
  /** Metadata about the chunk */
  metadata: {
    /** Document title or filename */
    source?: string;
    /** Chunk character count */
    charCount: number;
    /** Approximate word count */
    wordCount: number;
    /** Section header if found */
    section?: string;
  };
}

/**
 * Split a document into chunks optimized for embedding and retrieval.
 */
export function chunkDocument(
  document: string,
  options: ChunkingOptions = {}
): DocumentChunk[] {
  const {
    maxChunkSize = 1000,
    overlap = 200,
    strategy = "semantic",
    separators,
  } = options;

  if (!document.trim()) {
    return [];
  }

  switch (strategy) {
    case "markdown":
      return chunkMarkdown(document, maxChunkSize, overlap);
    case "semantic":
      return chunkSemantic(document, maxChunkSize, overlap, separators);
    case "fixed":
    default:
      return chunkFixed(document, maxChunkSize, overlap);
  }
}

/**
 * Fixed-size chunking with overlap.
 * Simple but effective for most use cases.
 */
function chunkFixed(
  text: string,
  maxChunkSize: number,
  overlap: number
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    const content = text.slice(start, end).trim();

    if (content) {
      chunks.push(createChunk(content, index, start, end));
    }

    // Move forward, accounting for overlap
    start += maxChunkSize - overlap;
    index++;

    // Prevent infinite loop
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Semantic chunking — splits at sentence/paragraph boundaries.
 * Produces more coherent chunks than fixed-size.
 */
function chunkSemantic(
  text: string,
  maxChunkSize: number,
  overlap: number,
  separators?: string[]
): DocumentChunk[] {
  const defaultSeparators = ["\n\n", "\n", ". ", "! ", "? ", "; "];
  const seps = separators ?? defaultSeparators;

  const chunks: DocumentChunk[] = [];
  let remaining = text;
  let globalOffset = 0;
  let index = 0;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      // Remaining text fits in one chunk
      chunks.push(createChunk(remaining.trim(), index, globalOffset, globalOffset + remaining.length));
      break;
    }

    // Find the best split point
    let splitPos = -1;
    for (const sep of seps) {
      // Look for the last occurrence of separator before maxChunkSize
      const pos = remaining.lastIndexOf(sep, maxChunkSize);
      if (pos > maxChunkSize * 0.3) {
        // Don't split too early (at least 30% of chunk size)
        splitPos = pos + sep.length;
        break;
      }
    }

    // Fallback: split at maxChunkSize
    if (splitPos === -1) {
      splitPos = maxChunkSize;
    }

    const content = remaining.slice(0, splitPos).trim();
    if (content) {
      chunks.push(createChunk(content, index, globalOffset, globalOffset + splitPos));
    }

    // Move forward with overlap
    const advance = splitPos - Math.min(overlap, splitPos * 0.3);
    remaining = remaining.slice(advance);
    globalOffset += advance;
    index++;
  }

  return chunks;
}

/**
 * Markdown-aware chunking — respects headers and code blocks.
 */
function chunkMarkdown(
  text: string,
  maxChunkSize: number,
  overlap: number
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const lines = text.split("\n");
  let currentChunk: string[] = [];
  let currentSection = "";
  let charOffset = 0;
  let chunkIndex = 0;

  for (const line of lines) {
    // Check if this is a header
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch && currentChunk.length > 0) {
      // Flush current chunk before new section
      const content = currentChunk.join("\n").trim();
      if (content) {
        chunks.push({
          ...createChunk(content, chunkIndex, charOffset - content.length, charOffset),
          metadata: {
            ...createChunk(content, chunkIndex, 0, 0).metadata,
            section: currentSection,
          },
        });
        chunkIndex++;
      }
      currentChunk = [];
    }

    if (headerMatch) {
      currentSection = headerMatch[2];
    }

    currentChunk.push(line);
    charOffset += line.length + 1; // +1 for newline

    // Check if chunk is getting too large
    const currentSize = currentChunk.join("\n").length;
    if (currentSize >= maxChunkSize) {
      const content = currentChunk.join("\n").trim();
      if (content) {
        chunks.push({
          ...createChunk(content, chunkIndex, charOffset - currentSize, charOffset),
          metadata: {
            ...createChunk(content, chunkIndex, 0, 0).metadata,
            section: currentSection,
          },
        });
        chunkIndex++;
      }

      // Keep last few lines for overlap
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

  // Don't forget the last chunk
  const lastContent = currentChunk.join("\n").trim();
  if (lastContent) {
    chunks.push({
      ...createChunk(lastContent, chunkIndex, charOffset - lastContent.length, charOffset),
      metadata: {
        ...createChunk(lastContent, chunkIndex, 0, 0).metadata,
        section: currentSection,
      },
    });
  }

  return chunks;
}

/**
 * Create a DocumentChunk with metadata.
 */
function createChunk(
  content: string,
  index: number,
  startOffset: number,
  endOffset: number
): DocumentChunk {
  const words = content.split(/\s+/).filter(Boolean);

  return {
    id: `chunk-${index}-${startOffset}`,
    content,
    index,
    startOffset,
    endOffset,
    metadata: {
      charCount: content.length,
      wordCount: words.length,
    },
  };
}

/**
 * Merge small chunks to meet minimum size requirements.
 * Useful for avoiding too many tiny chunks.
 */
export function mergeSmallChunks(
  chunks: DocumentChunk[],
  minSize: number = 200
): DocumentChunk[] {
  if (chunks.length <= 1) return chunks;

  const merged: DocumentChunk[] = [];
  let current = chunks[0];

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i];

    if (current.content.length < minSize) {
      // Merge current with next
      current = {
        ...current,
        content: `${current.content}\n\n${next.content}`,
        endOffset: next.endOffset,
        metadata: {
          ...current.metadata,
          charCount: current.content.length + next.content.length + 2,
          wordCount: current.metadata.wordCount + next.metadata.wordCount,
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
