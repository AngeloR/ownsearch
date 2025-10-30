# @surface/crawler

The crawler ingests a seed URL, follows same-domain links with
[Crawlee](https://crawlee.dev/), extracts clean article content using Mozilla’s
Readability library, and stores the results in Redis. Each document is written as:

- `crawler:doc:<slug>` &rarr; JSON payload `{ url, title, text, crawledAt }`
- `crawler:queue` (list) &rarr; Redis key queue consumed by the indexer

## Configuration

All options can be supplied via environment variables (defaults shown):

| Variable                  | Description                                              | Default                       |
| ------------------------- | -------------------------------------------------------- | ----------------------------- |
| `START_URL`               | Seed URL to crawl **(required in production)**           | _none_                        |
| `REDIS_URL`               | Redis connection string                                  | `redis://localhost:6379`      |
| `REDIS_QUEUE_KEY`         | Redis list key used as the document queue                | `crawler:queue`               |
| `REDIS_DOC_PREFIX`        | Key prefix for stored document payloads                  | `crawler:doc`                 |
| `MAX_REQUESTS_PER_CRAWL`  | Crawl limit (protects against infinite traversals)       | `100`                         |

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
pnpm --filter @surface/crawler build
```

### Running the crawler directly

```bash
START_URL=https://example.com \
REDIS_URL=redis://localhost:6379 \
pnpm --filter @surface/crawler start
```

Or pass the URL as an argument:

```bash
pnpm --filter @surface/crawler start https://example.com
```

The script logs saved Redis keys and queue operations. Use `redis-cli lrange crawler:queue 0 -1`
to inspect pending work or `redis-cli get <key>` to view stored payloads.

### Watch mode

For iterative development, rebuild on change:

```bash
pnpm --filter @surface/crawler dev
```

### Testing new dependencies

Because the project uses pnpm workspaces, run installs from the workspace root:

```bash
pnpm add <pkg> --filter @surface/crawler
```

## Architecture Notes

- Only same-domain links are enqueued (`strategy: "same-domain"`). Adjust the crawler
  implementation if you need broader traversals.
- Documents are normalized to lowercase URL slugs to avoid Redis key conflicts.
- No disk writes occur; everything is kept in Redis for the indexer to consume.
