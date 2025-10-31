# @ownsearch/api

The API exposes a Fastify-based search endpoint that blends full-text relevance
(`ts_rank`) with vector similarity from `pgvector`. Clients query `/search?q=...`
and receive ranked documents with snippet, aggregate score, and scoring breakdown.

## Configuration

| Variable               | Description                                                                    | Default                                              |
| ---------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `HOST`                 | Interface to bind                                                              | `0.0.0.0`                                            |
| `PORT`                 | Listen port                                                                    | `8000`                                               |
| `DATABASE_URL`         | PostgreSQL connection string                                                    | `postgres://postgres:postgres@localhost:5431/postgres` |
| `ROUTE_PREFIX`         | Optional path prefix for all routes (e.g. `/api`)                               | `/api`                                               |
| `EMBEDDING_DIMENSIONS` | Expected vector length (must match indexer output)                              | `384`                                                |
| `TEXT_WEIGHT`          | Weight applied to full-text score                                               | `0.6`                                                |
| `VECTOR_WEIGHT`        | Weight applied to cosine similarity                                             | `0.4`                                                |
| `RESULT_LIMIT`         | Maximum number of results returned (bounded by 50 in code)                      | `10`                                                 |
| `REDIS_URL`            | Redis connection string (for crawl queue enqueueing)                            | `redis://localhost:6379`                             |
| `REDIS_SEED_QUEUE`     | Redis list key that holds pending crawl requests                                | `crawler:seeds`                                      |

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL with pgvector (e.g. `docker run --rm -p 5431:5432 ankane/pgvector`)
- Documents and chunks inserted by the indexer (run the indexer/migrations beforehand)

### Setup

```bash
pnpm install
pnpm --filter @ownsearch/api build
```

### Running the API

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5431/postgres \
REDIS_URL=redis://localhost:6379 \
REDIS_SEED_QUEUE=crawler:seeds \
ROUTE_PREFIX=/api \
pnpm --filter @ownsearch/api start
```

With default settings the API listens at <http://localhost:8000/api/search>.

### Development mode

Use `tsc` watch output for rapid iteration:

```bash
pnpm --filter @ownsearch/api dev
```

### Querying

Example search request:

```bash
curl "http://localhost:8000/api/search?q=open+source"
```

Response excerpt:

```json
{
  "results": [
    {
      "documentId": "a6e36f5d-…",
      "url": "https://example.com/articles/foo",
      "title": "Example Article",
      "snippet": "…chunk text…",
      "score": 0.72,
      "textScore": 0.48,
      "vectorScore": 0.60
    }
  ]
}
```

### Enqueueing new crawl seeds

```bash
curl -X POST "http://localhost:8000/api/crawl" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/interesting"}'
```

The API normalises the URL, strips fragments, pushes it onto
`REDIS_SEED_QUEUE`, and returns the canonicalised value. The crawler polls the
same queue and will begin a new crawl cycle shortly after.

### Adding dependencies

```bash
pnpm add <package> --filter @ownsearch/api
```

## Implementation Notes

- The API uses deterministic embeddings (matching the indexer). Swap `embedText`
  for a model-backed service if needed.
- Searches always perform full-text filtering first, then re-rank with vector
  similarity; vector-only fallbacks ensure sparse results are still filled.
- CORS is enabled for all origins so the static UI or any client can query the API
  directly.
