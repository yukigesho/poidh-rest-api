import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import {
  CACHE_TTL_SECONDS,
  responseCache,
  type ResponseCache,
} from "./cache.js";

const fixture = () => {
  const values = new Map<string, string>();
  const ttls: number[] = [];
  const cache: ResponseCache = {
    get: async (key) => values.get(key) ?? null,
    set: async (key, body, ttl) => {
      values.set(key, body);
      ttls.push(ttl);
    },
  };
  return { cache, values, ttls };
};

test("reuses successful JSON responses with a fixed 24-hour TTL", async () => {
  const { cache, ttls } = fixture();
  const app = new Hono();
  let reads = 0;
  app.use("/api/v1/*", responseCache(cache));
  app.get("/api/v1/items", (c) => c.json({ reads: ++reads }));
  const first = await app.request("/api/v1/items?limit=1");
  const second = await app.request("/api/v1/items?limit=1");
  assert.equal(await first.text(), await second.text());
  assert.equal(second.headers.get("content-type"), "application/json");
  assert.equal(reads, 1);
  assert.deepEqual(ttls, [86_400]);
  assert.equal(CACHE_TTL_SECONDS, 86_400);
  await app.request("/api/v1/items?limit=2");
  assert.equal(reads, 2);
});

test("does not cache errors, non-JSON responses, or non-GET requests", async () => {
  const { cache, values } = fixture();
  const app = new Hono();
  app.use("*", responseCache(cache));
  app.get("/missing", (c) => c.json({ error: "missing" }, 404));
  app.get("/invalid", (c) => c.json({ error: "invalid" }, 400));
  app.get("/error", () => {
    throw new Error("database unavailable");
  });
  app.onError((_, c) => c.json({ error: "unavailable" }, 500));
  app.get("/text", (c) => c.text("hello"));
  app.post("/items", (c) => c.json({ ok: true }));
  for (const path of ["/missing", "/invalid", "/error", "/text"]) {
    await app.request(path);
  }
  await app.request("/items", { method: "POST" });
  assert.equal(values.size, 0);
});

test("Redis read and write failures do not break database responses", async () => {
  const cache: ResponseCache = {
    get: async () => {
      throw new Error("offline");
    },
    set: async () => {
      throw new Error("offline");
    },
  };
  const app = new Hono();
  app.use("*", responseCache(cache));
  app.get("/items", (c) => c.json({ ok: true }));
  const response = await app.request("/items");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("expired or evicted entries are loaded again", async () => {
  const { cache, values } = fixture();
  const app = new Hono();
  let reads = 0;
  app.use("*", responseCache(cache));
  app.get("/items", (c) => c.json({ reads: ++reads }));
  await app.request("/items");
  values.clear();
  await app.request("/items");
  assert.equal(reads, 2);
});
