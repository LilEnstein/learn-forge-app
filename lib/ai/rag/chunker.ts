// Sliding window chunker: ~512 tokens (≈2048 chars), 64-token overlap (≈256 chars)
const CHUNK_SIZE = 2048;
const OVERLAP = 256;

export interface Chunk {
  content: string;
  index: number;
  metadata: { position: number; charStart: number; charEnd: number };
}

export function chunkText(text: string): Chunk[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    let actualEnd = end;

    // Prefer breaking at sentence/word boundary
    if (end < cleaned.length) {
      const sentenceBreak = cleaned.lastIndexOf(". ", end);
      const wordBreak = cleaned.lastIndexOf(" ", end);
      if (sentenceBreak > start + CHUNK_SIZE / 2) {
        actualEnd = sentenceBreak + 1;
      } else if (wordBreak > start + CHUNK_SIZE / 2) {
        actualEnd = wordBreak;
      }
    }

    const content = cleaned.slice(start, actualEnd).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        index,
        metadata: { position: index, charStart: start, charEnd: actualEnd },
      });
      index++;
    }

    start = actualEnd - OVERLAP;
    if (start <= 0 && index > 0) break;
    if (start < 0) start = 0;
  }

  return chunks;
}
