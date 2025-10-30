export type ChunkingOptions = {
  chunkSize: number;
  overlap: number;
};

export function chunkText(text: string, options: ChunkingOptions): string[] {
  const words = text.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const { chunkSize, overlap } = options;
  const chunks: string[] = [];
  const step = Math.max(1, chunkSize - overlap);

  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(start + chunkSize, words.length);
    const slice = words.slice(start, end);
    if (slice.length === 0) continue;
    chunks.push(slice.join(" "));
    if (end === words.length) break;
  }

  return chunks;
}
