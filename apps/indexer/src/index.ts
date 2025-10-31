import { randomUUID } from "node:crypto";
import process from "node:process";

import { Redis as RedisClient } from "ioredis";

import { chunkText } from "./chunk.js";
import { createDbConnection } from "./db.js";
import { embedText, formatVectorLiteral } from "./embeddings.js";
import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  EMBEDDING_DIMENSIONS,
  REDIS_QUEUE_KEY,
  REDIS_URL,
} from "./config.js";
import type { ArticleRecord } from "./types.js";

const redis = new RedisClient(REDIS_URL);
const db = createDbConnection();

function parseTimestamp(value: string | undefined, fallback: Date): Date {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed;
}

async function processDocumentPayload(key: string): Promise<void> {
  const payload = await redis.get(key);
  if (!payload) {
    console.warn(`Payload missing for key ${key}, skipping.`);
    return;
  }

  let record: ArticleRecord;
  try {
    record = JSON.parse(payload) as ArticleRecord;
  } catch (error) {
    console.error(`Failed to parse payload for ${key}:`, error);
    return;
  }

  if (!record.text?.trim()) {
    console.warn(`Document ${key} has no text content, skipping.`);
    return;
  }

  let hostname: string | null = null;
  try {
    hostname = new URL(record.url).hostname;
  } catch (error) {
    console.warn(`Failed to parse hostname for URL ${record.url}, skipping host tracking.`);
  }

  const now = new Date();
  const crawledAt = parseTimestamp(record.crawledAt, now);
  const result = await db.transaction(async (trx) => {
    const existing = await trx("documents").where({ url: record.url }).first();

    let documentId: string;
    let addedAt: Date;

    if (existing) {
      documentId = existing.id as string;
      addedAt = new Date(existing.added_at as string);

      await trx("documents")
        .where({ id: documentId })
        .update({
          title: record.title,
          content: record.text,
          last_processed_at: now,
          metadata: JSON.stringify({
            crawledAt: record.crawledAt,
            lastKey: key,
          }),
          updated_at: now,
        });

      await trx("document_chunks").where({ document_id: documentId }).del();
    } else {
      documentId = randomUUID();
      addedAt = now;

      await trx("documents").insert({
        id: documentId,
        url: record.url,
        title: record.title,
        content: record.text,
        added_at: addedAt,
        last_processed_at: now,
        metadata: JSON.stringify({
          crawledAt: record.crawledAt,
          lastKey: key,
        }),
        updated_at: now,
      });
    }

    if (hostname) {
      await trx("crawled_sites")
        .insert({
          hostname,
          created_at: crawledAt,
          last_crawled_at: crawledAt,
        })
        .onConflict("hostname")
        .merge({
          last_crawled_at: crawledAt,
        });
    }

    const chunks = chunkText(record.text, {
      chunkSize: CHUNK_SIZE,
      overlap: CHUNK_OVERLAP,
    });

    if (chunks.length === 0) {
      console.warn(`No chunks produced for document ${documentId}`);
      return { documentId, chunkCount: 0, addedAt };
    }

    const rows = chunks.map((content, index) => {
      const embedding = embedText(content, EMBEDDING_DIMENSIONS);
      return {
        id: randomUUID(),
        document_id: documentId,
        chunk_index: index,
        content,
        embedding: trx.raw("?::vector", [formatVectorLiteral(embedding)]),
        created_at: now,
      };
    });

    await trx.batchInsert("document_chunks", rows, 50);
    return { documentId, chunkCount: rows.length, addedAt };
  });

  if (result) {
    const { documentId, chunkCount, addedAt } = result;
    console.info(
      `Indexed document ${documentId} (${chunkCount} chunks, originally added at ${addedAt.toISOString()})`
    );
  }
}

async function loop(): Promise<void> {
  console.info("Indexer service started. Waiting for documents...");
  while (true) {
    const result = await redis.blpop(REDIS_QUEUE_KEY, 0);
    if (!result) {
      continue;
    }
    const [, key] = result;

    try {
      await processDocumentPayload(key);
    } catch (error) {
      console.error(`Error processing key ${key}:`, error);
    }
  }
}

export async function main(): Promise<void> {
  try {
    await loop();
  } finally {
    await shutdown();
  }
}

async function shutdown(): Promise<void> {
  await Promise.allSettled([redis.quit(), db.destroy()]);
}

process.on("SIGINT", async () => {
  console.info("Received SIGINT, shutting down...");
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.info("Received SIGTERM, shutting down...");
  await shutdown();
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Indexer encountered an error:", error);
    process.exit(1);
  });
}
