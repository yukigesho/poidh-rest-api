import { Redis } from "ioredis";
import type { ResponseCache } from "./api/cache.js";
import { env } from "./env.js";

export const redisClient = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
          connectTimeout: 1_000,
          commandTimeout: 1_000,
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
      })
    : undefined;

// Avoid logging connection URLs, which can contain credentials.
redisClient?.on("error", () => {
    process.stderr.write(
        "Redis unavailable; cache requests will fall back to PostgreSQL\n",
    );
});

export const cache: ResponseCache | undefined = redisClient
    ? {
          get: (key) => redisClient.get(key),
          set: (key, body, ttlSeconds) =>
              redisClient.set(key, body, "EX", ttlSeconds),
      }
    : undefined;
