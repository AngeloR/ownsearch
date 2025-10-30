import type { Knex } from "knex";

const DOCUMENTS_TABLE = "documents";
const DOCUMENT_CHUNKS_TABLE = "document_chunks";

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "vector"');

  await knex.schema.createTable(DOCUMENTS_TABLE, (table) => {
    table.uuid("id").primary();
    table.text("url").notNullable().unique();
    table.text("title").notNullable();
    table.text("content").notNullable();
    table.timestamp("added_at", { useTz: true }).notNullable();
    table.timestamp("last_processed_at", { useTz: true }).notNullable();
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable(DOCUMENT_CHUNKS_TABLE, (table) => {
    table.uuid("id").primary();
    table
      .uuid("document_id")
      .notNullable()
      .references("id")
      .inTable(DOCUMENTS_TABLE)
      .onDelete("CASCADE");
    table.integer("chunk_index").notNullable();
    table.text("content").notNullable();
    table.specificType("embedding", "vector(384)").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(["document_id", "chunk_index"]);
    table.index(["document_id", "chunk_index"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(DOCUMENT_CHUNKS_TABLE);
  await knex.schema.dropTableIfExists(DOCUMENTS_TABLE);
}
