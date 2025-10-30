import knex, { type Knex } from "knex";
import { DATABASE_URL } from "./config.js";

export function createDbConnection(): Knex {
  return knex({
    client: "pg",
    connection: DATABASE_URL,
    pool: {
      min: 0,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
    },
  });
}
