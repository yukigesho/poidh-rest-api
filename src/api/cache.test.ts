import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { Hono } from "hono";
import {
  CACHE_TTL_SECONDS,
  responseCache,
  type ResponseCache,
} from "./cache.js";

const fixture = () => {
  let now = 0;
  const values = new Map<string, string>();
  const expires = new Map<string, number>();
  const ttls: number[] = [];
  const cache: ResponseCache = {
    get: async (key) => {
      if ((expires.get(key) ?? Infinity) <= now) values.delete(key);
      return values.get(key) ?? null;
    },
    set: async (key, body, ttl) => {
      values.set(key, body);
      ttls.push(ttl);
      expires.set(key, now + ttl);
    },
  };
  return {
    cache,
    values,
    ttls,
    advance: (seconds: number) => {
      now += seconds;
    },
  };
};

test("reuses successful JSON responses for 10 seconds with freshness headers", async () => {
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
  assert.deepEqual(ttls, [10]);
  assert.equal(CACHE_TTL_SECONDS, 10);
  assert.equal(first.headers.get("x-cache"), "MISS");
  assert.equal(second.headers.get("x-cache"), "HIT");
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(second.headers.get("cache-control"), "no-store");
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
  assert.equal(response.headers.get("x-cache"), "BYPASS");
  assert.deepEqual(await response.json(), { ok: true });
});

test("hits do not extend expiry; expired and evicted entries reload", async () => {
  const { cache, values, advance } = fixture();
  const app = new Hono();
  let reads = 0;
  app.use("*", responseCache(cache));
  app.get("/items", (c) => c.json({ reads: ++reads }));
  await app.request("/items");
  advance(9);
  assert.equal((await app.request("/items")).headers.get("x-cache"), "HIT");
  advance(1);
  assert.equal((await app.request("/items")).headers.get("x-cache"), "MISS");
  assert.equal(reads, 2);
  values.clear();
  await app.request("/items");
  assert.equal(reads, 3);
});

test("ignores existing 24-hour v1 entries without deleting shared Redis data", async () => {
  const { cache, values } = fixture();
  const url = "http://localhost/items";
  const digest = createHash("sha256").update(url).digest("hex");
  const oldKey = `poidh:rest-api:v1:${digest}`;
  values.set(oldKey, JSON.stringify({ stale: true }));
  const app = new Hono();
  app.use("*", responseCache(cache));
  app.get("/items", (c) => c.json({ fresh: true }));
  assert.deepEqual(await (await app.request(url)).json(), { fresh: true });
  assert.ok(values.has(oldKey));
  assert.ok(values.has(`poidh:rest-api:v2:${digest}`));
});
