import { createHash } from "node:crypto";

export function embedText(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const hash = createHash("sha256").update(token).digest();
    const index = (hash.readUInt32BE(0) >>> 0) % dimensions;
    const sign = hash[4] % 2 === 0 ? 1 : -1;
    const magnitude = hash.readUInt32BE(8) / 0xffffffff;
    vector[index] += sign * (1 + magnitude);
  }

  const norm = Math.hypot(...vector);
  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

export function formatVectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => value.toFixed(6)).join(",")}]`;
}
