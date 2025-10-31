import { Redis as RedisClient } from "ioredis";

import { REDIS_URL } from "./config.js";

const redis = new RedisClient(REDIS_URL);

redis.on("error", (error: Error) => {
  console.error("Redis connection error", error);
});

export function getRedis(): RedisClient {
  return redis;
}

export async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch (error) {
    console.error("Failed to close Redis connection", error);
  }
}
