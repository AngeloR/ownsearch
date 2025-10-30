import process from "node:process";

export const HOST = process.env.HOST ?? "0.0.0.0";
export const PORT = Number.parseInt(process.env.PORT ?? "8888", 10);

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
