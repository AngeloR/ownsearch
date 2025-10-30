import { JSDOM } from "jsdom";
import { CheerioCrawler } from "crawlee";
import { Readability } from "@mozilla/readability";
import { Redis as RedisClient } from "ioredis";
import process from "node:process";

const REDIS_URL = "redis://localhost:6379";
const REDIS_QUEUE_KEY = "crawler:queue";
const REDIS_DOC_PREFIX = "crawler:doc";

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

type ArticleRecord = {
  url: string;
  title: string;
  text: string;
  crawledAt: string;
};

async function runCrawler(startUrl: string): Promise<void> {
  ensureValidUrl(startUrl);

  const redis = new RedisClient(REDIS_URL);

  let pageCounter = 0;

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: 100,
    async requestHandler({ request, body, enqueueLinks, log }) {
      if (!body) {
        log.warning(`No body returned for ${request.url}, skipping.`);
        return;
      }

      const htmlContent = body.toString();
      const dom = new JSDOM(htmlContent, { url: request.url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      const title = article?.title?.trim() || dom.window.document.title || request.url;
      const textContent = article?.textContent?.trim();

      if (!textContent) {
        log.warning(`Readability could not extract content for ${request.url}`);
      } else {
        pageCounter += 1;
        const redisKey = buildRedisKey(request.loadedUrl ?? request.url, pageCounter);
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

      await enqueueLinks({
        strategy: "same-domain",
      });
    },
    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed too many times.`);
    },
  });

  try {
    await crawler.run([startUrl]);
  } finally {
    await redis.quit();
  }
}

export async function main(): Promise<void> {
  const [, , startUrl] = process.argv;
  if (!startUrl) {
    console.error("Usage: pnpm --filter @surface/crawler start <url>");
    process.exitCode = 1;
    return;
  }

  try {
    await runCrawler(startUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Crawler encountered an error: ${message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
