export type TextChunk = {
  content: string;
  index: number;
  charStart: number;
  charEnd: number;
};

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 150;

/**
 * Sliding-window chunker that prefers paragraph > sentence > word boundaries.
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP
): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = start + chunkSize;

    if (end >= normalized.length) {
      const content = normalized.slice(start).trim();
      if (content.length > 0) {
        chunks.push({ content, index, charStart: start, charEnd: normalized.length });
      }
      break;
    }

    end = findBestBreakpoint(normalized, start, end);
    const content = normalized.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({ content, index, charStart: start, charEnd: end });
      index++;
    }

    const next = end - overlap;
    start = next > start ? next : end; // prevent infinite loop
  }

  return chunks;
}

function findBestBreakpoint(text: string, start: number, idealEnd: number): number {
  const searchWindow = Math.floor((idealEnd - start) * 0.25);

  const paraBreak = text.lastIndexOf("\n\n", idealEnd);
  if (paraBreak > idealEnd - searchWindow) return paraBreak + 2;

  const sentenceBreak = findLastSentenceBreak(text, idealEnd - searchWindow, idealEnd);
  if (sentenceBreak !== -1) return sentenceBreak;

  const wordBreak = text.lastIndexOf(" ", idealEnd);
  if (wordBreak > idealEnd - searchWindow) return wordBreak + 1;

  return idealEnd;
}

function findLastSentenceBreak(text: string, from: number, to: number): number {
  for (let i = to; i >= from; i--) {
    if ([".", "!", "?", "\n"].includes(text[i]) && text[i + 1] === " ") {
      return i + 2;
    }
  }
  return -1;
}
