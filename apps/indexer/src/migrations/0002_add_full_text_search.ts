import type { Knex } from "knex";

const DOCUMENTS_TABLE = "documents";
const SEARCH_VECTOR_INDEX = "documents_search_vector_idx";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE ${DOCUMENTS_TABLE}
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector(
        'english',
        coalesce(title, '') || ' ' || coalesce(content, '')
      )
    ) STORED
  `);

  await knex.raw(`
    CREATE INDEX ${SEARCH_VECTOR_INDEX}
    ON ${DOCUMENTS_TABLE}
    USING GIN (search_vector)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS ${SEARCH_VECTOR_INDEX}`);
  await knex.raw(`ALTER TABLE ${DOCUMENTS_TABLE} DROP COLUMN IF EXISTS search_vector`);
}
