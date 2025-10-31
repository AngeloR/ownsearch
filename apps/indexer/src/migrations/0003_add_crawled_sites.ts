import type { Knex } from "knex";

const CRAWLED_SITES_TABLE = "crawled_sites";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(CRAWLED_SITES_TABLE, (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.text("hostname").notNullable().unique();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("last_crawled_at", { useTz: true }).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(CRAWLED_SITES_TABLE);
}
