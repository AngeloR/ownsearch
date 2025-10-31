# @ownsearch/search-ui

The search UI is a static HTML/CSS/TypeScript front-end served via nginx (in
production) or esbuild’s dev server (during development). It renders a single-page
experience with a search bar, calls the API, and displays ranked results with
scores and metadata.

## Configuration

| Variable / Mechanism | Description                                                                 | Default                                  |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| `API_BASE_URL`       | Absolute or relative URL for the search API (injected at container startup) | `/api` (same origin + `/api`)            |
| `public/env.js`      | Fallback that sets `window.__API_BASE_URL__` if the runtime variable is missing | `window.location.origin + "/api"` |

When deployed via Docker Compose, the entrypoint rewrites `/usr/share/nginx/html/env.js`
so the browser always hits the configured API endpoint.

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- Running API endpoint (local or remote)

### Setup

```bash
pnpm install
```

### Development server

```bash
API_BASE_URL=http://localhost:8000/api \
pnpm --filter @ownsearch/search-ui dev
```

This command launches esbuild’s dev server, serving the UI at <http://localhost:8000>
by default. Adjust `API_BASE_URL` to match your API host. (Use `--servedir=dist` default.)

### Production build

```bash
pnpm --filter @ownsearch/search-ui build
```

Artifacts land in `apps/search-ui/dist/`. Serve the directory with any static server
or reverse proxy. Remember to provide an `env.js` file in the root of the dist folder
with the correct API base URL, e.g.:

```js
window.__API_BASE_URL__ = "https://search.example.com/api";
```

### Adding dependencies

Install new packages from the monorepo root:

```bash
pnpm add <package> --filter @ownsearch/search-ui
```

## Implementation Notes

- The UI uses plain DOM APIs and a small amount of TypeScript; no frameworks required.
- Results show combined score plus component scores to aid debugging relevancy.
- Errors and empty states are surfaced inline to keep the UX responsive.
- `/admin.html` provides a lightweight admin view for enqueueing new crawl seeds and reviewing
  the currently indexed hostnames.
