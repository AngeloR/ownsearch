import type { FastifyPluginCallback } from "fastify";

import { REDIS_SEED_QUEUE } from "../config.js";
import { pool } from "../db.js";
import { getRedis } from "../redis.js";
import type { RescanResponseBody } from "../types.js";

const crawledSitesSql = `
  SELECT hostname
  FROM crawled_sites
  WHERE hostname IS NOT NULL
  ORDER BY hostname ASC
`;

function normalizeHostname(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSeedUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.pathname = "/";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

const adminRoutes: FastifyPluginCallback = async (fastify) => {
  fastify.post<{ Reply: RescanResponseBody | { error: string } }>(
    "/admin/rescan",
    async (request, reply) => {
      let hostnames: string[];

      try {
        const result = await pool.query<{ hostname: string | null }>(
          crawledSitesSql,
        );
        const normalized = result.rows
          .map((row) => normalizeHostname(row.hostname))
          .filter((hostname): hostname is string => Boolean(hostname));

        hostnames = Array.from(new Set(normalized));
      } catch (error) {
        request.log.error({ err: error }, "Failed to load crawled sites");
        reply.code(500);
        return { error: "Failed to load crawled sites." };
      }

      if (hostnames.length === 0) {
        return {
          attempted: 0,
          enqueued: 0,
          queue: REDIS_SEED_QUEUE,
        };
      }

      const hostSet = new Set(hostnames);
      const seeds = new Set<string>();

      for (const hostname of hostSet) {
        let seed = normalizeSeedUrl(`https://${hostname}`);
        if (!seed) {
          seed = normalizeSeedUrl(`http://${hostname}`);
        }
        if (seed) {
          seeds.add(seed);
        }
      }

      if (seeds.size === 0) {
        return {
          attempted: hostSet.size,
          enqueued: 0,
          queue: REDIS_SEED_QUEUE,
        };
      }

      try {
        const redis = getRedis();
        const enqueued = await redis.sadd(REDIS_SEED_QUEUE, [...seeds]);

        request.log.info(
          { attempted: seeds.size, enqueued },
          "Scheduled recrawl for crawled sites",
        );

        return {
          attempted: seeds.size,
          enqueued,
          queue: REDIS_SEED_QUEUE,
        };
      } catch (error) {
        request.log.error({ err: error }, "Failed to enqueue recrawl seeds");
        reply.code(500);
        return { error: "Failed to enqueue recrawl seeds." };
      }
    },
  );
};

export default adminRoutes;
