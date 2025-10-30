import process from "node:process";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const REDIS_QUEUE_KEY = process.env.REDIS_QUEUE_KEY ?? "crawler:queue";
export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5431/postgres";

export const EMBEDDING_DIMENSIONS = Number.parseInt(
  process.env.EMBEDDING_DIMENSIONS ?? "384",
  10
);

export const CHUNK_SIZE = Number.parseInt(process.env.CHUNK_SIZE ?? "200", 10);
export const CHUNK_OVERLAP = Number.parseInt(process.env.CHUNK_OVERLAP ?? "40", 10);
