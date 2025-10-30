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

RUN pnpm --filter @surface/crawler build

FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/crawler/package.json apps/crawler/
COPY apps/indexer/package.json apps/indexer/
COPY apps/search-ui/package.json apps/search-ui/

RUN pnpm install --filter @surface/crawler --prod --frozen-lockfile

COPY --from=builder /app/apps/crawler/dist apps/crawler/dist

WORKDIR /app/apps/crawler

ENV REDIS_URL=redis://redis:6379
ENV REDIS_QUEUE_KEY=crawler:queue
ENV REDIS_DOC_PREFIX=crawler:doc
ENV MAX_REQUESTS_PER_CRAWL=100

CMD ["node", "dist/index.js"]
