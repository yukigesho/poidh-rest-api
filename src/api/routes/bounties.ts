import { and, asc, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/index.js";
import {
  bounties,
  claims,
  participationsBounties,
  transactions,
  users,
  votes,
} from "../../db/schema.js";
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
  const issuer = addressQuery(c, "issuer");
  const inProgress = booleanQuery(c, "inProgress");
  const isJoinedBounty = booleanQuery(c, "isJoinedBounty");
  const isCanceled = booleanQuery(c, "isCanceled");
  const isMultiplayer = booleanQuery(c, "isMultiplayer");
  const isVoting = booleanQuery(c, "isVoting");

  if (chainId !== undefined) filters.push(eq(bounties.chainId, chainId));
  if (id !== undefined) filters.push(eq(bounties.id, id));
  if (onChainId !== undefined) filters.push(eq(bounties.onChainId, onChainId));
  if (issuer !== undefined) filters.push(eq(bounties.issuer, issuer));
  if (inProgress !== undefined)
    filters.push(eq(bounties.inProgress, inProgress));
  if (isJoinedBounty !== undefined) {
    filters.push(eq(bounties.isJoinedBounty, isJoinedBounty));
  }
  if (isCanceled !== undefined)
    filters.push(eq(bounties.isCanceled, isCanceled));
  if (isMultiplayer !== undefined) {
    filters.push(eq(bounties.isMultiplayer, isMultiplayer));
  }
  if (isVoting !== undefined) filters.push(eq(bounties.isVoting, isVoting));

  const rows = await db
    .select()
    .from(bounties)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(bounties.chainId), asc(bounties.id))
    .limit(limit)
    .offset(offset);

  return json(c, rows);
});

app.get("/:chainId/:bountyId", async (c) => {
  const chainId = integer(c.req.param("chainId"), "chainId");
  const bountyId = integer(c.req.param("bountyId"), "bountyId");
  const includes = includeSet(
    c,
    ["issuer", "claims", "participants", "votes", "transactions"],
    ["issuer", "claims", "participants", "votes", "transactions"],
  );

  const [bounty] = await db
    .select()
    .from(bounties)
    .where(and(eq(bounties.chainId, chainId), eq(bounties.id, bountyId)))
    .limit(1);

  if (!bounty) return c.json({ error: "Bounty not found" }, 404);

  const [issuer, bountyClaims, participants, bountyVotes, bountyTransactions] =
    await Promise.all([
      includes.has("issuer")
        ? db
            .select()
            .from(users)
            .where(eq(users.address, bounty.issuer))
            .limit(1)
        : Promise.resolve(undefined),
      includes.has("claims")
        ? db
            .select()
            .from(claims)
            .where(
              and(eq(claims.chainId, chainId), eq(claims.bountyId, bountyId)),
            )
            .orderBy(asc(claims.id))
        : Promise.resolve(undefined),
      includes.has("participants")
        ? db
            .select()
            .from(participationsBounties)
            .where(
              and(
                eq(participationsBounties.chainId, chainId),
                eq(participationsBounties.bountyId, bountyId),
              ),
            )
            .orderBy(asc(participationsBounties.userAddress))
        : Promise.resolve(undefined),
      includes.has("votes")
        ? db
            .select()
            .from(votes)
            .where(
              and(eq(votes.chainId, chainId), eq(votes.bountyId, bountyId)),
            )
            .orderBy(asc(votes.round))
        : Promise.resolve(undefined),
      includes.has("transactions")
        ? db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.chainId, chainId),
                eq(transactions.bountyId, bountyId),
              ),
            )
            .orderBy(asc(transactions.timestamp), asc(transactions.index))
        : Promise.resolve(undefined),
    ]);

  return json(c, {
    ...bounty,
    ...(issuer && { issuerUser: issuer[0] ?? null }),
    ...(bountyClaims && { claims: bountyClaims }),
    ...(participants && { participants }),
    ...(bountyVotes && { votes: bountyVotes }),
    ...(bountyTransactions && { transactions: bountyTransactions }),
  });
});

export default app;
