import dotenv from "dotenv";

// Local development uses .env.local; deployed environments usually inject values.
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const port = Number(process.env.PORT ?? 42070);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

export const env = {
  DATABASE_URL: databaseUrl,
  REDIS_URL: process.env.REDIS_URL,
  PORT: port,
};
