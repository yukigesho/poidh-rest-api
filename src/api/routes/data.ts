import { and, asc, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db/index.js";
import {
  leaderboard,
  participationsBounties,
  transactions,
  votes,
} from "../../db/schema.js";
import { addressQuery, integerQuery, json, pagination } from "../http.js";

const app = new Hono();

app.get("/votes", async (c) => {
  const { limit, offset } = pagination(c);
  const filters: SQL[] = [];
  const chainId = integerQuery(c, "chainId");
  const bountyId = integerQuery(c, "bountyId");
  const claimId = integerQuery(c, "claimId");
  const round = integerQuery(c, "round");

  if (chainId !== undefined) filters.push(eq(votes.chainId, chainId));
  if (bountyId !== undefined) filters.push(eq(votes.bountyId, bountyId));
  if (claimId !== undefined) filters.push(eq(votes.claimId, claimId));
  if (round !== undefined) filters.push(eq(votes.round, round));

  const rows = await db
    .select()
    .from(votes)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(votes.chainId), asc(votes.bountyId), asc(votes.round))
    .limit(limit)
    .offset(offset);

  return json(c, rows);
});

app.get("/participations", async (c) => {
  const { limit, offset } = pagination(c);
  const filters: SQL[] = [];
  const chainId = integerQuery(c, "chainId");
  const bountyId = integerQuery(c, "bountyId");
  const userAddress = addressQuery(c, "userAddress");

  if (chainId !== undefined) {
    filters.push(eq(participationsBounties.chainId, chainId));
  }
  if (bountyId !== undefined) {
    filters.push(eq(participationsBounties.bountyId, bountyId));
  }
  if (userAddress !== undefined) {
    filters.push(eq(participationsBounties.userAddress, userAddress));
  }

  const rows = await db
    .select()
    .from(participationsBounties)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      asc(participationsBounties.chainId),
      asc(participationsBounties.bountyId),
      asc(participationsBounties.userAddress),
    )
    .limit(limit)
    .offset(offset);

  return json(c, rows);
});

app.get("/transactions", async (c) => {
  const { limit, offset } = pagination(c);
  const filters: SQL[] = [];
  const chainId = integerQuery(c, "chainId");
  const bountyId = integerQuery(c, "bountyId");
  const claimId = integerQuery(c, "claimId");
  const eventIndex = integerQuery(c, "index");
  const transactionAddress = addressQuery(c, "address");
  const tx = c.req.query("tx");
  const action = c.req.query("action");

  if (chainId !== undefined) filters.push(eq(transactions.chainId, chainId));
  if (bountyId !== undefined) filters.push(eq(transactions.bountyId, bountyId));
  if (claimId !== undefined) filters.push(eq(transactions.claimId, claimId));
  if (eventIndex !== undefined)
    filters.push(eq(transactions.index, eventIndex));
  if (transactionAddress !== undefined) {
    filters.push(eq(transactions.address, transactionAddress));
  }
  if (tx !== undefined) filters.push(eq(transactions.tx, tx.toLowerCase()));
  if (action !== undefined) filters.push(eq(transactions.action, action));

  const rows = await db
    .select()
    .from(transactions)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      asc(transactions.chainId),
      asc(transactions.timestamp),
      asc(transactions.index),
    )
    .limit(limit)
    .offset(offset);

  return json(c, rows);
});

app.get("/leaderboard", async (c) => {
  const { limit, offset } = pagination(c);
  const filters: SQL[] = [];
  const chainId = integerQuery(c, "chainId");
  const userAddress = addressQuery(c, "address");

  if (chainId !== undefined) filters.push(eq(leaderboard.chainId, chainId));
  if (userAddress !== undefined) {
    filters.push(eq(leaderboard.address, userAddress));
  }

  const rows = await db
    .select()
    .from(leaderboard)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(leaderboard.chainId), asc(leaderboard.address))
    .limit(limit)
    .offset(offset);

  return json(c, rows);
});

export default app;
