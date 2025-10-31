import { CheerioCrawler, sleep } from "crawlee";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { Redis as RedisClient } from "ioredis";
import process from "node:process";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const REDIS_QUEUE_KEY = process.env.REDIS_QUEUE_KEY ?? "crawler:queue";
const REDIS_DOC_PREFIX = process.env.REDIS_DOC_PREFIX ?? "crawler:doc";
const REDIS_CACHE_PREFIX = process.env.REDIS_CACHE_PREFIX ?? "crawler:cache";
const REDIS_SEED_QUEUE = process.env.REDIS_SEED_QUEUE ?? "crawler:seeds";
const POLL_INTERVAL_RAW = Number.parseInt(
  process.env.SEED_POLL_INTERVAL_MS ?? "10000",
  10,
);
const POLL_INTERVAL_MS =
  Number.isFinite(POLL_INTERVAL_RAW) && POLL_INTERVAL_RAW > 0
    ? POLL_INTERVAL_RAW
    : 10000;
const MAX_REQUESTS_PER_CRAWL = Number.parseInt(
  process.env.MAX_REQUESTS_PER_CRAWL ?? "100",
  10,
);

function ensureValidUrl(url: string): URL {
  try {
    return new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL provided: ${url}`);
  }
}

function sanitizeSegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildRedisKey(targetUrl: string, index: number): string {
  const { hostname, pathname } = new URL(targetUrl);
  const hostSegment = sanitizeSegment(hostname) || "site";
  const pathSegment = sanitizeSegment(pathname) || "page";
  const prefix = `${index.toString().padStart(3, "0")}-${hostSegment}-${pathSegment}`;
  return `${REDIS_DOC_PREFIX}:${prefix}`;
}

function buildCacheKey(targetUrl: string): string {
  return `${REDIS_CACHE_PREFIX}:${new URL(targetUrl).href}`;
}

type ArticleRecord = {
  url: string;
  title: string;
  text: string;
  crawledAt: string;
};

type PageCounter = { value: number };

function createCrawler(
  redis: RedisClient,
  counter: PageCounter,
): CheerioCrawler {
  const minDelay = Number.parseInt(
    process.env.CRAWL_DELAY_MIN_MS ?? "3000",
    10,
  );
  const maxDelay = Number.parseInt(
    process.env.CRAWL_DELAY_MAX_MS ?? "7000",
    10,
  );
  const effectiveMin =
    Number.isFinite(minDelay) && minDelay >= 0 ? minDelay : 3000;
  const effectiveMax =
    Number.isFinite(maxDelay) && maxDelay >= effectiveMin
      ? maxDelay
      : effectiveMin + 4000;

  const randomDelay = () =>
    Math.floor(Math.random() * (effectiveMax - effectiveMin + 1)) +
    effectiveMin;

  return new CheerioCrawler({
    maxRequestsPerCrawl: MAX_REQUESTS_PER_CRAWL,
    requestHandlerTimeoutSecs: Math.max(effectiveMax / 1000 + 30, 60),
    preNavigationHooks: [
      async ({ request, log }) => {
        try {
          const cacheKey = buildCacheKey(request.url);
          const [etag, lastModified] = await redis.hmget(
            cacheKey,
            "etag",
            "lastModified",
          );
          const headers: Record<string, string> = {};
          const existing = request.headers as Record<
            string,
            string | string[] | undefined
          > | null;
          if (existing) {
            for (const [key, value] of Object.entries(existing)) {
              if (typeof value === "string") {
                headers[key] = value;
              } else if (Array.isArray(value)) {
                headers[key] = value.join(", ");
              }
            }
          }

          if (etag) {
            headers["If-None-Match"] = etag;
          }
          if (lastModified) {
            headers["If-Modified-Since"] = lastModified;
          }

          request.headers = headers;
        } catch (error) {
          log.debug(
            "Failed to attach conditional headers; proceeding without cache hints.",
            { url: request.url, err: error },
          );
        }
      },
    ],
    async requestHandler({ request, body, enqueueLinks, log, response }) {
      const statusCode = response?.statusCode ?? response?.status ?? 0;
      if (statusCode === 304) {
        log.info(
          `Content not modified for ${request.url}, skipping processing.`,
        );
        return;
      }

      if (!body) {
        log.warning(`No body returned for ${request.url}, skipping.`);
        return;
      }

      const htmlContent = body.toString();
      const dom = new JSDOM(htmlContent, { url: request.url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      const title =
        article?.title?.trim() || dom.window.document.title || request.url;
      const textContent = article?.textContent?.trim();

      if (!textContent) {
        log.warning(`Readability could not extract content for ${request.url}`);
      } else {
        counter.value += 1;
        const redisKey = buildRedisKey(
          request.loadedUrl ?? request.url,
          counter.value,
        );
        const record: ArticleRecord = {
          url: request.loadedUrl ?? request.url,
          title,
          text: textContent,
          crawledAt: new Date().toISOString(),
        };

        await redis.set(redisKey, JSON.stringify(record));
        await redis.rpush(REDIS_QUEUE_KEY, redisKey);
        log.info(`Stored parsed content under key ${redisKey}`);
      }

      try {
        const cacheKey = buildCacheKey(request.loadedUrl ?? request.url);
        const headers = response?.headers ?? {};
        const etagHeader = headers["etag"] ?? headers["ETag"];
        const lastModifiedHeader =
          headers["last-modified"] ?? headers["Last-Modified"];
        const cacheControlHeader =
          headers["cache-control"] ?? headers["Cache-Control"];

        const payload: Record<string, string> = {};
        if (typeof etagHeader === "string" && etagHeader.trim()) {
          payload.etag = etagHeader.trim();
        }
        if (
          typeof lastModifiedHeader === "string" &&
          lastModifiedHeader.trim()
        ) {
          payload.lastModified = lastModifiedHeader.trim();
        }
        if (
          typeof cacheControlHeader === "string" &&
          cacheControlHeader.trim()
        ) {
          payload.cacheControl = cacheControlHeader.trim();
        }
        if (Object.keys(payload).length > 0) {
          payload.lastFetchedAt = new Date().toISOString();
          await redis.hset(cacheKey, payload);
        } else {
          await redis.del(cacheKey);
        }
      } catch (error) {
        log.debug("Failed to persist cache metadata.", {
          url: request.url,
          err: error,
        });
      }

      await enqueueLinks({
        transformRequestFunction: (req) => {
          const skipEndings = [".pdf", ".gif", ".png", ".jpg", ".xml"];

          const skip = skipEndings.some((t) => req.url.endsWith(t));
          if (skip) {
            log.debug(`Skipping ${req.url.endsWith}`);
            return false;
          }

          return req;
        },
      });

      const delay = randomDelay();
      log.debug(`Sleeping ${delay}ms before next request`);
      await sleep(delay);
    },
    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed too many times.`);
    },
  });
}

async function popSeed(redis: RedisClient): Promise<string | null> {
  const seed = await redis.spop(REDIS_SEED_QUEUE);
  return seed === null ? null : seed;
}

async function waitForSeed(redis: RedisClient): Promise<string> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const seed = await popSeed(redis);
    if (seed) return seed;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function runLoop(initialUrl: string | undefined): Promise<void> {
  const redis = new RedisClient(REDIS_URL);
  const counter: PageCounter = { value: 0 };

  try {
    let current: string | null = initialUrl ?? (await popSeed(redis));

    if (!current) {
      console.log(
        "Crawler idle: awaiting URLs on seed queue",
        REDIS_SEED_QUEUE,
      );
    }

    while (true) {
      const urlToCrawl = current ?? (await waitForSeed(redis));
      current = null;

      let parsedSeed: URL;
      try {
        parsedSeed = ensureValidUrl(urlToCrawl);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Invalid seed URL '${urlToCrawl}': ${message}`);
        continue;
      }

      counter.value = 0;
      const crawler = createCrawler(redis, counter);

      try {
        console.info(`Starting crawl for ${parsedSeed.href}`);
        await crawler.run([parsedSeed.href]);
        console.info(`Completed crawl for ${parsedSeed.href}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Crawler error for ${urlToCrawl}: ${message}`);
      }
      const requestQueue = await crawler.getRequestQueue();
      await requestQueue.drop();
      console.info("Cleared request queue storage after crawl.");
    }
  } finally {
    await redis.quit();
  }
}

export async function main(): Promise<void> {
  const [, , argUrl] = process.argv;
  const startUrl = argUrl ?? process.env.START_URL;

  try {
    await runLoop(startUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Crawler encountered an error: ${message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
