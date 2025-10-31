import type { FastifyPluginCallback } from "fastify";

import { pool } from "../db.js";
import type { HostInfo, HostListResponseBody } from "../types.js";

const crawledSitesSql = `
  SELECT
    hostname,
    last_crawled_at
  FROM crawled_sites
  WHERE hostname IS NOT NULL
  ORDER BY hostname ASC
`;

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

const hostsRoutes: FastifyPluginCallback = async (fastify) => {
  fastify.get<{ Reply: HostListResponseBody | { error: string } }>(
    "/hosts",
    async (request, reply) => {
      try {
        const result = await pool.query<{ hostname: string | null; last_crawled_at: Date | null }>(
          crawledSitesSql,
        );

        const hosts: HostInfo[] = result.rows
          .map((row) => {
            const hostname = row.hostname?.trim();
            if (!hostname) {
              return undefined;
            }

            return {
              hostname,
              lastCrawledAt: toIsoString(row.last_crawled_at),
            };
          })
          .filter((entry): entry is HostInfo => Boolean(entry));

        return { hosts };
      } catch (error) {
        request.log.error({ err: error }, "Failed to fetch crawled sites");
        reply.code(500);
        return { error: "Failed to retrieve hostnames." };
      }
    },
  );
};

export default hostsRoutes;
