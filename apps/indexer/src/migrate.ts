import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Knex } from "knex";

import { createDbConnection } from "./db.js";

async function runMigrations(): Promise<void> {
  const db = createDbConnection();
  const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

  try {
    await db.migrate.latest({
      directory: migrationsDir,
      loadExtensions: [".js"],
    });
    console.info("Migrations applied successfully.");
  } finally {
    await (db as Knex).destroy();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch((error) => {
    console.error("Failed to run migrations:", error);
    process.exit(1);
  });
}
