import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

export const databaseClient = postgres(env.DATABASE_URL, {
  max: 10,
  connection: { search_path: "public" },
});

export const db = drizzle(databaseClient, { schema });

export const checkDatabaseConnection = async () => {
  await databaseClient`select 1`;
};
