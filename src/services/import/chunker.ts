export interface TextChunk { content: string; index: number; }

export function chunkTextWithOverlap(text: string, chunkSize = 600, overlap = 100): TextChunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= chunkSize) return [{ content: text, index: 0 }];
  const chunks: TextChunk[] = [];
  let idx = 0, start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push({ content: words.slice(start, end).join(' '), index: idx++ });
    if (end === words.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
}
