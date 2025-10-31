import process from "node:process";

export const HOST = process.env.HOST ?? "0.0.0.0";
export const PORT = Number.parseInt(process.env.PORT ?? "8000", 10);

export const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5431/postgres";

export const EMBEDDING_DIMENSIONS = Number.parseInt(
  process.env.EMBEDDING_DIMENSIONS ?? "384",
  10,
);

export const TEXT_WEIGHT = Number.parseFloat(process.env.TEXT_WEIGHT ?? "0.6");
export const VECTOR_WEIGHT = Number.parseFloat(
  process.env.VECTOR_WEIGHT ?? "0.4",
);
export const RESULT_LIMIT = Number.parseInt(
  process.env.RESULT_LIMIT ?? "10",
  10,
);

function normalizeRoutePrefix(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return undefined;
  }
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  if (!withoutTrailing) {
    return undefined;
  }
  return withoutTrailing.startsWith("/")
    ? withoutTrailing
    : `/${withoutTrailing}`;
}

export const ROUTE_PREFIX = normalizeRoutePrefix(process.env.ROUTE_PREFIX);

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const REDIS_SEED_QUEUE =
  process.env.REDIS_SEED_QUEUE ?? "crawler:seeds";
