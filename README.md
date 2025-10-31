# Surface Platform

Surface is a small end‑to‑end content discovery stack. It crawls seed URLs, stores
structured articles, generates vector embeddings, exposes a hybrid semantic search
API, and presents a minimalist search UI. The entire system can be launched in
containers with a single command.

## Prerequisites

- Docker **24+**
- Docker Compose **v2**
- At least 4 GB RAM available for containers

## Quick Start (All Services)

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd surface
   ```

2. **Create an environment file**

   ```bash
   cp .env.example .env
   ```

   Review `.env` and, at minimum, set `CRAWLER_START_URL` to the site you want to
   crawl. Adjust host ports if any default conflicts with existing services.

3. **Launch the stack**

   ```bash
   docker compose --env-file .env up --build -d
   ```

   Docker Compose builds each application image (crawler, indexer, API, search UI),
   starts Redis and pgvector/PostgreSQL, runs schema migrations, and brings every
   service online.

4. **Access the search UI**

   Visit <http://localhost:8080> (or whichever port you configured). The UI proxies
   requests to the API under `/api`.

5. **Queue additional crawl jobs (optional)**

   ```bash
   curl -X POST "http://localhost:8000/api/crawl" \\
     -H "Content-Type: application/json" \\
     -d '{"url": "https://example.com"}'
   ```

   The crawler polls this queue continuously and will process new URLs as they
   arrive.

6. **Stop the stack**

   ```bash
   docker compose down
   ```

## Services & Ports (Defaults)

| Service      | Description                              | Port |
| ------------ | ---------------------------------------- | ---- |
| `redis`      | FIFO queue for crawler/indexer           | 6379 |
| `pgvector`   | PostgreSQL + pgvector extension          | 5431 |
| `api`        | Fastify hybrid full-text/vector search   | 8000 |
| `crawler`    | Crawlee + Readability content fetcher    | n/a (worker) |
| `indexer`    | Redis consumer + pgvector ingester       | n/a (worker) |
| `search-ui`  | Static HTML/TS front-end (nginx)         | 8080 |

## Configuration Overview

All tunable options live in `.env`. Key settings:

- **Redis:** `REDIS_URL`, `REDIS_HOST_PORT`, `REDIS_SEED_QUEUE`
- **Postgres:** `DATABASE_URL`, `PGVECTOR_HOST_PORT`,
  `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- **Crawler:** `CRAWLER_START_URL`, queue/document prefixes, `SEED_POLL_INTERVAL_MS`
- **Indexer:** chunk sizing, embedding dimension overrides
- **API:** route prefix, weighting for text vs vector relevance, listen port
- **Search UI:** `SEARCH_UI_API_BASE_URL` (defaults to `/api`)

Refer to each app’s README inside `apps/*/README.md` for development-level
instructions and deeper explanations.

## Observing Logs

Use standard Compose tooling:

```bash
docker compose logs -f api
docker compose logs -f crawler
docker compose logs -f indexer
```

## Data Persistence

The current configuration keeps Redis and PostgreSQL data inside container volumes.
Adapt the compose file for bind mounts or managed services if you need durability
beyond the lifecycle of the containers.

## Troubleshooting

- `indexer` retries migrations until pgvector is reachable. If it keeps failing,
  confirm the connection string in `.env` points to `pgvector` (not `localhost`).
- The crawler only follows links on the same domain by default; raise or lower
  `CRAWLER_MAX_REQUESTS` as required.
- Use `POST /api/crawl` with a JSON body `{"url": "https://example.com"}` to
  queue on-demand crawl jobs while the system is running.
- To rebuild images after code changes: `docker compose --env-file .env up --build`.

Enjoy exploring! Each application has a dedicated README with development-focused
details if you want to work on components individually.
