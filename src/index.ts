import { serve } from "@hono/node-server";
import app from "./api/index.js";
import { redisClient } from "./cache.js";
import { databaseClient } from "./db/index.js";
import { env } from "./env.js";

const server = serve({
  fetch: app.fetch,
  port: env.PORT,
});

process.stdout.write(
  `POIDH REST API listening on http://localhost:${env.PORT}\n`,
);

const shutdown = (signal: string) => {
  process.stdout.write(`${signal} received, shutting down\n`);
  server.close(() => {
    redisClient?.disconnect();
    void databaseClient.end({ timeout: 5 }).finally(() => process.exit(0));
  });
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
