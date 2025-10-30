import { Pool } from "pg";

import { DATABASE_URL } from "./config.js";

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
});

pool.on("error", (error: Error) => {
  console.error("Unexpected error on PostgreSQL client", error);
});

export async function closePool(): Promise<void> {
  await pool.end();
}
