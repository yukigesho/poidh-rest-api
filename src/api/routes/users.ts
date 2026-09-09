import { and, asc, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "../../db/index.js";
import {
  bounties,
  claims,
  leaderboard,
  participationsBounties,
  transactions,
  users,
} from "../../db/schema.js";
import {
  address,
  addressQuery,
  includeSet,
  integerQuery,
  json,
  pagination,
} from "../http.js";

const app = new Hono();

app.get("/", async (c) => {
  const { limit, offset } = pagination(c);
  const filters: SQL[] = [];
  const userAddress = addressQuery(c, "address");
  if (userAddress !== undefined) filters.push(eq(users.address, userAddress));

  const rows = await db
    .select()
    .from(users)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(users.address))
    .limit(limit)
    .offset(offset);

  return json(c, rows);
});

app.get("/:address", async (c) => {
  const userAddress = address(c.req.param("address"));
  const includes = includeSet(
    c,
    [
      "bounties",
      "issuedClaims",
      "ownedClaims",
      "participations",
      "transactions",
      "leaderboard",
    ],
    [
      "bounties",
      "issuedClaims",
      "ownedClaims",
      "participations",
      "transactions",
      "leaderboard",
    ],
  );
  const chainId = integerQuery(c, "chainId");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.address, userAddress))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  const chainFilter = (column: AnyPgColumn) =>
    chainId === undefined ? undefined : eq(column, chainId);

  const [
    userBounties,
    issuedClaims,
    ownedClaims,
    participations,
    activity,
    score,
  ] = await Promise.all([
    includes.has("bounties")
      ? db
          .select()
          .from(bounties)
          .where(
            and(
              eq(bounties.issuer, userAddress),
              chainFilter(bounties.chainId),
            ),
          )
          .orderBy(asc(bounties.chainId), asc(bounties.id))
      : Promise.resolve(undefined),
    includes.has("issuedClaims")
      ? db
          .select()
          .from(claims)
          .where(
            and(eq(claims.issuer, userAddress), chainFilter(claims.chainId)),
          )
          .orderBy(asc(claims.chainId), asc(claims.id))
      : Promise.resolve(undefined),
    includes.has("ownedClaims")
      ? db
          .select()
          .from(claims)
          .where(
            and(eq(claims.owner, userAddress), chainFilter(claims.chainId)),
          )
          .orderBy(asc(claims.chainId), asc(claims.id))
      : Promise.resolve(undefined),
    includes.has("participations")
      ? db
          .select()
          .from(participationsBounties)
          .where(
            and(
              eq(participationsBounties.userAddress, userAddress),
              chainFilter(participationsBounties.chainId),
            ),
          )
          .orderBy(
            asc(participationsBounties.chainId),
            asc(participationsBounties.bountyId),
          )
      : Promise.resolve(undefined),
    includes.has("transactions")
      ? db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.address, userAddress),
              chainFilter(transactions.chainId),
            ),
          )
          .orderBy(asc(transactions.timestamp), asc(transactions.index))
      : Promise.resolve(undefined),
    includes.has("leaderboard")
      ? db
          .select()
          .from(leaderboard)
          .where(
            and(
              eq(leaderboard.address, userAddress),
              chainFilter(leaderboard.chainId),
            ),
          )
          .orderBy(asc(leaderboard.chainId))
      : Promise.resolve(undefined),
  ]);

  return json(c, {
    ...user,
    ...(userBounties && { bounties: userBounties }),
    ...(issuedClaims && { issuedClaims }),
    ...(ownedClaims && { ownedClaims }),
    ...(participations && { participations }),
    ...(activity && { transactions: activity }),
    ...(score && { leaderboard: score }),
  });
});

export default app;
