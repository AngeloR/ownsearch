import type { FastifyPluginCallback } from "fastify";

import { pool } from "../db.js";
import type { HostListResponseBody } from "../types.js";

const hostnamesSql = `
  SELECT DISTINCT 
    lower(split_part(substring(url FROM '^[a-zA-Z]+://([^/]+)'), ':', 1)) AS host
  FROM documents
  WHERE url IS NOT NULL
    AND url <> ''
  ORDER BY host ASC
`;

const hostsRoutes: FastifyPluginCallback = async (fastify) => {
  fastify.get<{ Reply: HostListResponseBody | { error: string } }>(
    "/hosts",
    async (request, reply) => {
      try {
        const result = await pool.query<{ host: string | null }>(hostnamesSql);
        const hosts = Array.from(
          new Set(
            result.rows
              .map((row) => row.host?.trim())
              .filter((host): host is string => Boolean(host)),
          ),
        );

        return { hosts };
      } catch (error) {
        request.log.error({ err: error }, "Failed to fetch hostnames");
        reply.code(500);
        return { error: "Failed to retrieve hostnames." };
      }
    },
  );
};

export default hostsRoutes;
