import { inspect } from "node:util";
import { swaggerUI } from "@hono/swagger-ui";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cache } from "../cache.js";
import { checkDatabaseConnection, db } from "../db/index.js";
import { bounties, claims, participationsBounties } from "../db/schema.js";
import { responseCache } from "./cache.js";
import { json } from "./http.js";
import { openAPI } from "./openAPI.js";
import bountiesApi from "./routes/bounties.js";
import claimsApi from "./routes/claims.js";
import dataApi from "./routes/data.js";
import usersApi from "./routes/users.js";

const app = new Hono();

if (cache) {
  const middleware = responseCache(cache);
  for (const path of [
    "/api/v1/*",
    "/bounty/*",
    "/claim/*",
    "/live/*",
    "/voting/*",
    "/past/*",
  ]) {
    app.use(path, middleware);
  }
}

const parseIntegerParam = (value: string) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

app.route("/openapi", openAPI);
app.get("/swagger", swaggerUI({ url: "/openapi/doc" }));

app.route("/api/v1/bounties", bountiesApi);
app.route("/api/v1/claims", claimsApi);
app.route("/api/v1/users", usersApi);
app.route("/api/v1", dataApi);

app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/ready", async (c) => {
  try {
    await checkDatabaseConnection();
    return c.json({ status: "ready" });
  } catch {
    return c.json({ status: "unavailable" }, 503);
  }
});

app.get("/bounty/participations/:chainId/:bountyId", async (c) => {
  const chainId = parseIntegerParam(c.req.param("chainId"));
  const bountyId = parseIntegerParam(c.req.param("bountyId"));
  if (chainId === null || bountyId === null) {
    return c.json({ error: "chainId and bountyId must be integers" }, 400);
  }

  const rows = await db
    .select()
    .from(participationsBounties)
    .where(
      and(
        eq(participationsBounties.bountyId, bountyId),
        eq(participationsBounties.chainId, chainId),
      ),
    );

  return json(c, rows);
});

app.get("/bounty/claims/:chainId/:bountyId", async (c) => {
  const chainId = parseIntegerParam(c.req.param("chainId"));
  const bountyId = parseIntegerParam(c.req.param("bountyId"));
  if (chainId === null || bountyId === null) {
    return c.json({ error: "chainId and bountyId must be integers" }, 400);
  }

  const rows = await db
    .select()
    .from(claims)
    .where(and(eq(claims.chainId, chainId), eq(claims.bountyId, bountyId)))
    .orderBy(asc(claims.id));

  return json(c, rows);
});

app.get("/bounty/:chainId", async (c) => {
  const chainId = parseIntegerParam(c.req.param("chainId"));
  if (chainId === null)
    return c.json({ error: "chainId must be an integer" }, 400);

  const rows = await db
    .select()
    .from(bounties)
    .where(eq(bounties.chainId, chainId))
    .orderBy(asc(bounties.id));

  return json(c, rows);
});

app.get("/bounty/:chainId/:bountyId", async (c) => {
  const chainId = parseIntegerParam(c.req.param("chainId"));
  const bountyId = parseIntegerParam(c.req.param("bountyId"));
  if (chainId === null || bountyId === null) {
    return c.json({ error: "chainId and bountyId must be integers" }, 400);
  }

  const [bounty] = await db
    .select()
    .from(bounties)
    .where(and(eq(bounties.chainId, chainId), eq(bounties.id, bountyId)))
    .limit(1);

  return json(c, bounty);
});

app.get("/live/bounty/:chainId", async (c) => {
  const chainId = parseIntegerParam(c.req.param("chainId"));
  if (chainId === null)
    return c.json({ error: "chainId must be an integer" }, 400);

  const rows = await db
    .select()
    .from(bounties)
    .where(
      and(
        eq(bounties.chainId, chainId),
        eq(bounties.inProgress, true),
        eq(bounties.isVoting, false),
      ),
    );

  return json(c, rows);
});

app.get("/voting/bounty/:chainId", async (c) => {
  const chainId = parseIntegerParam(c.req.param("chainId"));
  if (chainId === null)
    return c.json({ error: "chainId must be an integer" }, 400);

  const rows = await db
    .select()
    .from(bounties)
    .where(
      and(
        eq(bounties.chainId, chainId),
        eq(bounties.inProgress, true),
        eq(bounties.isVoting, true),
      ),
    );

  return json(c, rows);
});

app.get("/past/bounty/:chainId", async (c) => {
  const chainId = parseIntegerParam(c.req.param("chainId"));
  if (chainId === null)
    return c.json({ error: "chainId must be an integer" }, 400);

  const rows = await db
    .select()
    .from(bounties)
    .where(
      and(
        eq(bounties.chainId, chainId),
        eq(bounties.inProgress, false),
        eq(bounties.isCanceled, false),
      ),
    );

  return json(c, rows);
});

app.get("/claim/:chainId", async (c) => {
  const chainId = parseIntegerParam(c.req.param("chainId"));
  if (chainId === null)
    return c.json({ error: "chainId must be an integer" }, 400);

  const rows = await db
    .select()
    .from(claims)
    .where(eq(claims.chainId, chainId))
    .orderBy(asc(claims.id));

  return json(c, rows);
});

app.get("/claim/:chainId/:claimId", async (c) => {
  const chainId = parseIntegerParam(c.req.param("chainId"));
  const claimId = parseIntegerParam(c.req.param("claimId"));
  if (chainId === null || claimId === null) {
    return c.json({ error: "chainId and claimId must be integers" }, 400);
  }

  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq(claims.chainId, chainId), eq(claims.id, claimId)))
    .limit(1);

  return json(c, claim);
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  // Drizzle wraps the database error in `cause`, which error.stack omits.
  process.stderr.write(`${inspect(error, { depth: 5, colors: false })}\n`);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
