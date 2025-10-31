# @ownsearch/crawler

The crawler ingests seed URLs, follows same-domain links with
[Crawlee](https://crawlee.dev/), extracts clean article content using Mozilla’s
Readability library, and stores the results in Redis. Each document is written as:

- `crawler:doc:<slug>` &rarr; JSON payload `{ url, title, text, crawledAt }`
- `crawler:queue` (list) &rarr; Redis key queue consumed by the indexer
- `crawler:seeds` (list) &rarr; Seed URL queue watched for new crawl requests

## Configuration

All options can be supplied via environment variables (defaults shown):

| Variable                  | Description                                              | Default                       |
| ------------------------- | -------------------------------------------------------- | ----------------------------- |
| `START_URL`               | Seed URL to crawl **(required in production)**           | _none_                        |
| `REDIS_URL`               | Redis connection string                                  | `redis://localhost:6379`      |
| `REDIS_QUEUE_KEY`         | Redis list key used as the document queue                | `crawler:queue`               |
| `REDIS_SEED_QUEUE`        | Redis list key supplying additional seed URLs            | `crawler:seeds`               |
| `REDIS_DOC_PREFIX`        | Key prefix for stored document payloads                  | `crawler:doc`                 |
| `MAX_REQUESTS_PER_CRAWL`  | Crawl limit (protects against infinite traversals)       | `100`                         |
| `SEED_POLL_INTERVAL_MS`   | Interval between seed-queue polls (ms)                   | `10000`                       |
| `CRAWL_DELAY_MIN_MS`      | Minimum delay between processed pages (ms)               | `3000`                        |
| `CRAWL_DELAY_MAX_MS`      | Maximum delay between processed pages (ms)               | `7000`                        |

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- Redis running locally (e.g. `docker run --rm -p 6379:6379 redis:7-alpine`)

### Setup

```bash
# install root deps
pnpm install

# build the TypeScript sources
pnpm --filter @ownsearch/crawler build
```

### Running the crawler directly

```bash
START_URL=https://example.com \
REDIS_URL=redis://localhost:6379 \
REDIS_SEED_QUEUE=crawler:seeds \
pnpm --filter @ownsearch/crawler start
```

Or pass the URL as an argument:

```bash
pnpm --filter @ownsearch/crawler start https://example.com
```

The script logs saved Redis keys and queue operations. Use `redis-cli lrange crawler:queue 0 -1`
to inspect pending work or `redis-cli get <key>` to view stored payloads. Additional seed URLs
can be queued by pushing onto `REDIS_SEED_QUEUE`, for example via the API:

```bash
curl -X POST "http://localhost:8000/api/crawl" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Watch mode

For iterative development, rebuild on change:

```bash
pnpm --filter @ownsearch/crawler dev
```

### Testing new dependencies

Because the project uses pnpm workspaces, run installs from the workspace root:

```bash
pnpm add <pkg> --filter @ownsearch/crawler
```

### Refreshing the Docker container

Rebuild and restart the crawler service whenever you update its code:

```bash
docker compose build crawler
docker compose up -d --force-recreate crawler
```

The crawler drops its persistent Crawlee request queue after each run so future crawls can revisit the same URLs.

## Architecture Notes

- Only same-domain links are enqueued (`strategy: "same-domain"`). Adjust the crawler
  implementation if you need broader traversals.
- Documents are normalized to lowercase URL slugs to avoid Redis key conflicts.
- The crawler runs continuously, polling `REDIS_SEED_QUEUE` for new URLs. The API
  (or any Redis client) can push additional seeds via `RPUSH`.
- No disk writes occur; everything is kept in Redis for the indexer to consume.
