import { createHash } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export const CACHE_TTL_SECONDS = 10;

export interface ResponseCache {
  get(key: string): Promise<string | null>;
  set(key: string, body: string, ttlSeconds: number): Promise<unknown>;
}

/** Cache only public, successful JSON GET responses. Redis failures fail open. */
export const responseCache =
  (cache: ResponseCache): MiddlewareHandler =>
  async (c, next) => {
    if (c.req.method !== "GET") {
      await next();
      return;
    }

    // Redis owns the short cache lifetime; do not add browser/CDN staleness.
    c.header("Cache-Control", "no-store");
    c.header("X-Cache", "MISS");

    // Preserve query ordering, including duplicate parameters, to avoid collisions.
    const digest = createHash("sha256").update(c.req.url).digest("hex");
    // Rotate the namespace so old 24-hour entries are never served.
    const key = `poidh:rest-api:v2:${digest}`;

    try {
      const body = await cache.get(key);
      if (body !== null) {
        c.res = new Response(body, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "X-Cache": "HIT",
          },
        });
        return;
      }
    } catch {
      c.header("X-Cache", "BYPASS");
      // The database remains available when Redis is not.
    }

    await next();
    if (
      c.res.status !== 200 ||
      !c.res.headers.get("Content-Type")?.startsWith("application/json")
    ) {
      return;
    }

    try {
      await cache.set(key, await c.res.clone().text(), CACHE_TTL_SECONDS);
    } catch {
      c.header("X-Cache", "BYPASS");
      // Never turn a successful database response into a cache error.
    }
  };
