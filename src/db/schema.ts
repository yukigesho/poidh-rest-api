import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
} from "drizzle-orm/pg-core";

// The indexer owns these tables. The API only reads them. The database client
// pins search_path to public, while pgTable models PostgreSQL's default schema.
export const bounties = pgTable(
  "Bounties",
  {
    id: integer("id").notNull(),
    chainId: integer("chainId").notNull(),
    onChainId: integer("onChainId").notNull(),
    createdAt: bigint("createdAt", { mode: "bigint" }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    amount: text("amount").notNull(),
    issuer: text("issuer").notNull(),
    inProgress: boolean("inProgress").default(true),
    isJoinedBounty: boolean("isJoinedBounty").default(false),
    isCanceled: boolean("isCanceled").default(false),
    isMultiplayer: boolean("isMultiplayer").default(false),
    isVoting: boolean("isVoting").default(false),
    deadline: integer("deadline"),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.chainId] }),
    index("Bounties_chain_idx").on(table.chainId),
    index("Bounties_onChainId_idx").on(table.onChainId),
  ],
);

export const votes = pgTable(
  "Votes",
  {
    chainId: integer("chainId").notNull(),
    bountyId: integer("bountyId").notNull(),
    claimId: integer("claimId").notNull(),
    yes: bigint("yes", { mode: "bigint" }).notNull(),
    no: bigint("no", { mode: "bigint" }).notNull(),
    round: integer("round").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bountyId, table.chainId, table.round] }),
  ],
);

export const claims = pgTable(
  "Claims",
  {
    id: integer("id").notNull(),
    chainId: integer("chainId").notNull(),
    onChainId: integer("onChainId").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    url: text("url").notNull(),
    issuer: text("issuer").notNull(),
    isAccepted: boolean("isAccepted").default(false),
    isVoting: boolean("isVoting").default(false),
    bountyId: integer("bountyId").notNull(),
    owner: text("owner").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.chainId] }),
    index("Claims_chain_idx").on(table.chainId),
    index("Claims_bounty_idx").on(table.bountyId),
    index("Claims_owner_idx").on(table.owner),
    index("Claims_onChainId_idx").on(table.onChainId),
  ],
);

export const users = pgTable(
  "Users",
  {
    address: text("address").notNull(),
    withdrawalAmountDegen: real("withdrawalAmountDegen").default(0),
    withdrawalAmountBase: real("withdrawalAmountBase").default(0),
    withdrawalAmountArbitrum: real("withdrawalAmountArbitrum").default(0),
    withdrawalAmountMainnet: real("withdrawalAmountMainnet").default(0),
  },
  (table) => [primaryKey({ columns: [table.address] })],
);

export const leaderboard = pgTable(
  "Leaderboard",
  {
    address: text("address").notNull(),
    chainId: integer("chainId").notNull(),
    earned: real("earned").default(0),
    paid: real("paid").default(0),
    nfts: real("nfts").default(0),
  },
  (table) => [
    primaryKey({ columns: [table.address, table.chainId] }),
    index("Leaderboard_address_idx").on(table.address),
    index("Leaderboard_chain_idx").on(table.chainId),
  ],
);

export const participationsBounties = pgTable(
  "ParticipationsBounties",
  {
    userAddress: text("userAddress").notNull(),
    bountyId: integer("bountyId").notNull(),
    chainId: integer("chainId").notNull(),
    amount: text("amount").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userAddress, table.bountyId, table.chainId],
    }),
  ],
);

export const transactions = pgTable(
  "Transactions",
  {
    tx: text("tx").notNull(),
    index: integer("index").notNull(),
    bountyId: integer("bountyId").notNull(),
    claimId: integer("claimId"),
    chainId: integer("chainId").notNull(),
    address: text("address").notNull(),
    action: text("action").notNull(),
    timestamp: bigint("timestamp", { mode: "bigint" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.tx,
        table.index,
        table.chainId,
        table.bountyId,
        table.address,
      ],
    }),
  ],
);
