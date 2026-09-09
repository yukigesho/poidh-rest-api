import { and, asc, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { bounties, claims, users } from "../../db/schema.js";
import {
  addressQuery,
  booleanQuery,
  includeSet,
  integer,
  integerQuery,
  json,
  pagination,
} from "../http.js";

const app = new Hono();

app.get("/", async (c) => {
  const { limit, offset } = pagination(c);
  const filters: SQL[] = [];

  const chainId = integerQuery(c, "chainId");
  const id = integerQuery(c, "id");
  const onChainId = integerQuery(c, "onChainId");
  const bountyId = integerQuery(c, "bountyId");
  const issuer = addressQuery(c, "issuer");
  const owner = addressQuery(c, "owner");
  const isAccepted = booleanQuery(c, "isAccepted");
  const isVoting = booleanQuery(c, "isVoting");

  if (chainId !== undefined) filters.push(eq(claims.chainId, chainId));
  if (id !== undefined) filters.push(eq(claims.id, id));
  if (onChainId !== undefined) filters.push(eq(claims.onChainId, onChainId));
  if (bountyId !== undefined) filters.push(eq(claims.bountyId, bountyId));
  if (issuer !== undefined) filters.push(eq(claims.issuer, issuer));
  if (owner !== undefined) filters.push(eq(claims.owner, owner));
  if (isAccepted !== undefined) filters.push(eq(claims.isAccepted, isAccepted));
  if (isVoting !== undefined) filters.push(eq(claims.isVoting, isVoting));

  const rows = await db
    .select()
    .from(claims)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(claims.chainId), asc(claims.id))
    .limit(limit)
    .offset(offset);

  return json(c, rows);
});

app.get("/:chainId/:claimId", async (c) => {
  const chainId = integer(c.req.param("chainId"), "chainId");
  const claimId = integer(c.req.param("claimId"), "claimId");
  const includes = includeSet(
    c,
    ["bounty", "issuer", "owner"],
    ["bounty", "issuer", "owner"],
  );

  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq(claims.chainId, chainId), eq(claims.id, claimId)))
    .limit(1);

  if (!claim) return c.json({ error: "Claim not found" }, 404);

  const [bounty, issuer, owner] = await Promise.all([
    includes.has("bounty")
      ? db
          .select()
          .from(bounties)
          .where(
            and(eq(bounties.chainId, chainId), eq(bounties.id, claim.bountyId)),
          )
          .limit(1)
      : Promise.resolve(undefined),
    includes.has("issuer")
      ? db.select().from(users).where(eq(users.address, claim.issuer)).limit(1)
      : Promise.resolve(undefined),
    includes.has("owner")
      ? db.select().from(users).where(eq(users.address, claim.owner)).limit(1)
      : Promise.resolve(undefined),
  ]);

  return json(c, {
    ...claim,
    ...(bounty && { bounty: bounty[0] ?? null }),
    ...(issuer && { issuerUser: issuer[0] ?? null }),
    ...(owner && { ownerUser: owner[0] ?? null }),
  });
});

export default app;
