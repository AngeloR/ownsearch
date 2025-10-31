# @ownsearch/indexer

The indexer drains the crawler’s Redis queue, stores full documents in PostgreSQL,
breaks content into overlapping chunks, generates deterministic embeddings, and
persists vectors via the `pgvector` extension. The resulting tables (`documents`
and `document_chunks`) power the hybrid text/vector search API.

## Configuration

| Variable                 | Description                                                          | Default                                            |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------- |
| `REDIS_URL`              | Redis connection string                                               | `redis://localhost:6379`                           |
| `REDIS_QUEUE_KEY`        | List key that feeds documents from the crawler                        | `crawler:queue`                                    |
| `DATABASE_URL`           | PostgreSQL connection string (must have `vector` extension installed) | `postgres://postgres:postgres@localhost:5431/postgres` |
| `EMBEDDING_DIMENSIONS`   | Length of generated embeddings                                        | `384`                                              |
| `CHUNK_SIZE`             | Number of words per chunk                                             | `200`                                              |
| `CHUNK_OVERLAP`          | Word overlap between adjacent chunks                                  | `40`                                               |

All values can be exported whenever you run the service (`pnpm` commands shown below).

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- Redis (e.g. `docker run --rm -p 6379:6379 redis:7-alpine`)
- PostgreSQL with pgvector (e.g. `docker run --rm -p 5431:5432 ankane/pgvector`)

> The default `DATABASE_URL` assumes the pgvector container above. Adjust ports or
> credentials as needed.

### Install & build

```bash
pnpm install
pnpm --filter @ownsearch/indexer build
```

### Run migrations

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5431/postgres \
pnpm --filter @ownsearch/indexer migrate
```

This creates the `documents` and `document_chunks` tables and enables the `uuid-ossp`
and `vector` extensions (idempotent).

### Launch the indexer

```bash
REDIS_URL=redis://localhost:6379 \
DATABASE_URL=postgres://postgres:postgres@localhost:5431/postgres \
pnpm --filter @ownsearch/indexer start
```

Logs display the number of chunks generated per document. To inspect the database:

```sql
SELECT id, title, added_at FROM documents ORDER BY added_at DESC LIMIT 5;
SELECT COUNT(*) FROM document_chunks;
```

### Watching for changes

```bash
pnpm --filter @ownsearch/indexer dev
```

### Consuming new dependencies

Install workspace dependencies from the monorepo root:

```bash
pnpm add <package> --filter @ownsearch/indexer
```

## Operational Notes

- The indexer overwrites existing rows for the same document URL, making re-crawls
  idempotent.
- Embeddings are deterministic hash projections; swap out `embedText` for a real
  model if required.
- Chunking happens before inserting into the vector table; tune the size/overlap
  for your content characteristics.
