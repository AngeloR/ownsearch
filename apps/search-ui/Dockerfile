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

RUN pnpm --filter @surface/search-ui build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/search-ui/dist /usr/share/nginx/html
COPY apps/search-ui/docker-entrypoint.sh /docker-entrypoint.d/10-env.sh

ENV API_BASE_URL=http://api:8000

CMD ["nginx", "-g", "daemon off;"]
