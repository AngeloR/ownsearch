# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/crawler/package.json apps/crawler/
COPY apps/indexer/package.json apps/indexer/
COPY apps/search-ui/package.json apps/search-ui/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @surface/indexer build

FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/crawler/package.json apps/crawler/
COPY apps/indexer/package.json apps/indexer/
COPY apps/search-ui/package.json apps/search-ui/

RUN pnpm install --filter @surface/indexer --prod --frozen-lockfile

COPY --from=builder /app/apps/indexer/dist apps/indexer/dist

WORKDIR /app/apps/indexer

ENV REDIS_URL=redis://redis:6379
ENV REDIS_QUEUE_KEY=crawler:queue
ENV DATABASE_URL=postgres://postgres:postgres@pgvector:5432/postgres
ENV EMBEDDING_DIMENSIONS=384
ENV CHUNK_SIZE=200
ENV CHUNK_OVERLAP=40

COPY apps/indexer/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]
