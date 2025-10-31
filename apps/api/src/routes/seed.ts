import type { FastifyInstance, FastifyPluginCallback } from "fastify";

import { REDIS_SEED_QUEUE } from "../config.js";
import { getRedis } from "../redis.js";

type EnqueueBody = {
  url?: string;
};

type EnqueueResponse = {
  url: string;
  queue: string;
};

function normalizeUrl(input: string): string {
  const parsed = new URL(input);
  parsed.hash = "";
  return parsed.toString();
}

const seedRoutes: FastifyPluginCallback = async (fastify: FastifyInstance) => {
  fastify.post<{ Body: EnqueueBody; Reply: EnqueueResponse | { error: string } }>(
    "/crawl",
    async (request, reply) => {
      const rawUrl = request.body?.url?.trim();

      if (!rawUrl) {
        reply.code(400);
        return { error: "Missing 'url' in request body." };
      }

      let normalized: string;

      try {
        normalized = normalizeUrl(rawUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reply.code(400);
        return { error: `Invalid URL: ${message}` };
      }

      const redis = getRedis();

      try {
        await redis.rpush(REDIS_SEED_QUEUE, normalized);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        request.log.error({ err: error }, "Failed to enqueue crawl request");
        reply.code(500);
        return { error: `Failed to enqueue URL: ${message}` };
      }

      request.log.info({ url: normalized }, "Enqueued crawl request");

      return {
        url: normalized,
        queue: REDIS_SEED_QUEUE,
      };
    }
  );
};

export default seedRoutes;
