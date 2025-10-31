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

RUN pnpm --filter @ownsearch/api build

FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/crawler/package.json apps/crawler/
COPY apps/indexer/package.json apps/indexer/
COPY apps/search-ui/package.json apps/search-ui/

RUN pnpm install --filter @ownsearch/api --prod --frozen-lockfile

COPY --from=builder /app/apps/api/dist apps/api/dist

WORKDIR /app/apps/api

ENV HOST=0.0.0.0
ENV PORT=8000

CMD ["node", "dist/index.js"]
