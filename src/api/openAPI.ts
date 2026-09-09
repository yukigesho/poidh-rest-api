import { Hono } from "hono";

const integerQuery = (name: string, description?: string) => ({
  name,
  in: "query",
  required: false,
  description,
  schema: { type: "integer" },
});

const stringQuery = (name: string, description?: string) => ({
  name,
  in: "query",
  required: false,
  description,
  schema: { type: "string" },
});

const booleanQuery = (name: string) => ({
  name,
  in: "query",
  required: false,
  schema: { type: "boolean" },
});

const pagination = [
  {
    name: "limit",
    in: "query",
    description: "Rows to return (default 50, maximum 100)",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
  },
  {
    name: "offset",
    in: "query",
    description: "Rows to skip",
    schema: { type: "integer", minimum: 0, default: 0 },
  },
];

const pathInteger = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "integer" },
});

const pathAddress = {
  name: "address",
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
};

const listResponse = (schema: string, description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "array",
        items: { $ref: `#/components/schemas/${schema}` },
      },
    },
  },
});

const itemResponse = (schema: string, description: string) => ({
  description,
  content: {
    "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
  },
});

const errorResponses = {
  400: {
    description: "Invalid parameter",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  },
};

const addressSchema = {
  type: "string",
  pattern: "^0x[0-9a-fA-F]{40}$",
  example: "0xbed82560c39c133a3d64516ecda82c71b72f3cd7",
};

const document = {
  openapi: "3.0.3",
  info: {
    version: "1.0.0",
    title: "POIDH Public Data API",
    description:
      "Read-only REST API over POIDH's indexed tables in PostgreSQL's public schema. List filters can be combined and use AND semantics.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/v1/bounties": {
      get: {
        summary: "List and filter bounties",
        tags: ["Bounties"],
        parameters: [
          integerQuery("chainId"),
          integerQuery("id"),
          integerQuery("onChainId"),
          stringQuery("issuer", "EVM address"),
          booleanQuery("inProgress"),
          booleanQuery("isJoinedBounty"),
          booleanQuery("isCanceled"),
          booleanQuery("isMultiplayer"),
          booleanQuery("isVoting"),
          ...pagination,
        ],
        responses: {
          200: listResponse("Bounty", "Matching bounties"),
          ...errorResponses,
        },
      },
    },
    "/api/v1/bounties/{chainId}/{bountyId}": {
      get: {
        summary: "Get a bounty and selected relations",
        tags: ["Bounties"],
        parameters: [
          pathInteger("chainId"),
          pathInteger("bountyId"),
          stringQuery(
            "include",
            "Comma-separated: issuer,claims,participants,votes,transactions. All are included by default; pass an empty value for none.",
          ),
        ],
        responses: {
          200: itemResponse("BountyDetail", "Bounty with requested relations"),
          404: { description: "Bounty not found" },
          ...errorResponses,
        },
      },
    },
    "/api/v1/claims": {
      get: {
        summary: "List and filter claims",
        tags: ["Claims"],
        parameters: [
          integerQuery("chainId"),
          integerQuery("id"),
          integerQuery("onChainId"),
          integerQuery("bountyId"),
          stringQuery("issuer", "EVM address"),
          stringQuery("owner", "EVM address"),
          booleanQuery("isAccepted"),
          booleanQuery("isVoting"),
          ...pagination,
        ],
        responses: {
          200: listResponse("Claim", "Matching claims"),
          ...errorResponses,
        },
      },
    },
    "/api/v1/claims/{chainId}/{claimId}": {
      get: {
        summary: "Get a claim and selected relations",
        tags: ["Claims"],
        parameters: [
          pathInteger("chainId"),
          pathInteger("claimId"),
          stringQuery(
            "include",
            "Comma-separated: bounty,issuer,owner. All are included by default; pass an empty value for none.",
          ),
        ],
        responses: {
          200: itemResponse("ClaimDetail", "Claim with requested relations"),
          404: { description: "Claim not found" },
          ...errorResponses,
        },
      },
    },
    "/api/v1/users": {
      get: {
        summary: "List users",
        tags: ["Users"],
        parameters: [stringQuery("address", "EVM address"), ...pagination],
        responses: {
          200: listResponse("User", "Matching users"),
          ...errorResponses,
        },
      },
    },
    "/api/v1/users/{address}": {
      get: {
        summary: "Get a user and selected relations",
        tags: ["Users"],
        parameters: [
          pathAddress,
          integerQuery(
            "chainId",
            "Restrict every included relation to this chain",
          ),
          stringQuery(
            "include",
            "Comma-separated: bounties,issuedClaims,ownedClaims,participations,transactions,leaderboard. All are included by default.",
          ),
        ],
        responses: {
          200: itemResponse("UserDetail", "User with requested relations"),
          404: { description: "User not found" },
          ...errorResponses,
        },
      },
    },
    "/api/v1/votes": {
      get: {
        summary: "List and filter votes",
        tags: ["Votes"],
        parameters: [
          integerQuery("chainId"),
          integerQuery("bountyId"),
          integerQuery("claimId"),
          integerQuery("round"),
          ...pagination,
        ],
        responses: {
          200: listResponse("Vote", "Matching votes"),
          ...errorResponses,
        },
      },
    },
    "/api/v1/participations": {
      get: {
        summary: "List and filter bounty participations",
        tags: ["Participations"],
        parameters: [
          integerQuery("chainId"),
          integerQuery("bountyId"),
          stringQuery("userAddress", "EVM address"),
          ...pagination,
        ],
        responses: {
          200: listResponse("Participation", "Matching participations"),
          ...errorResponses,
        },
      },
    },
    "/api/v1/transactions": {
      get: {
        summary: "List and filter indexed transactions",
        tags: ["Transactions"],
        parameters: [
          integerQuery("chainId"),
          integerQuery("bountyId"),
          integerQuery("claimId"),
          integerQuery("index"),
          stringQuery("address", "EVM address"),
          stringQuery("tx", "Transaction hash"),
          stringQuery("action"),
          ...pagination,
        ],
        responses: {
          200: listResponse("Transaction", "Matching transactions"),
          ...errorResponses,
        },
      },
    },
    "/api/v1/leaderboard": {
      get: {
        summary: "List and filter leaderboard scores",
        tags: ["Leaderboard"],
        parameters: [
          integerQuery("chainId"),
          stringQuery("address", "EVM address"),
          ...pagination,
        ],
        responses: {
          200: listResponse("LeaderboardEntry", "Matching scores"),
          ...errorResponses,
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string" } },
      },
      BigInteger: {
        oneOf: [{ type: "integer" }, { type: "string" }],
        description: "A JSON number when safe, otherwise a decimal string",
      },
      Bounty: {
        type: "object",
        required: [
          "id",
          "chainId",
          "onChainId",
          "createdAt",
          "title",
          "description",
          "amount",
          "issuer",
        ],
        properties: {
          id: { type: "integer" },
          chainId: { type: "integer" },
          onChainId: { type: "integer" },
          createdAt: { $ref: "#/components/schemas/BigInteger" },
          title: { type: "string" },
          description: { type: "string" },
          amount: { type: "string", description: "Raw token amount" },
          issuer: addressSchema,
          inProgress: { type: "boolean", nullable: true },
          isJoinedBounty: { type: "boolean", nullable: true },
          isCanceled: { type: "boolean", nullable: true },
          isMultiplayer: { type: "boolean", nullable: true },
          isVoting: { type: "boolean", nullable: true },
          deadline: { type: "integer", nullable: true },
        },
      },
      Claim: {
        type: "object",
        required: [
          "id",
          "chainId",
          "onChainId",
          "title",
          "description",
          "url",
          "issuer",
          "bountyId",
          "owner",
        ],
        properties: {
          id: { type: "integer" },
          chainId: { type: "integer" },
          onChainId: { type: "integer" },
          title: { type: "string" },
          description: { type: "string" },
          url: { type: "string" },
          issuer: addressSchema,
          isAccepted: { type: "boolean", nullable: true },
          isVoting: { type: "boolean", nullable: true },
          bountyId: { type: "integer" },
          owner: addressSchema,
        },
      },
      User: {
        type: "object",
        required: ["address"],
        properties: {
          address: addressSchema,
          withdrawalAmountDegen: { type: "number", nullable: true },
          withdrawalAmountBase: { type: "number", nullable: true },
          withdrawalAmountArbitrum: { type: "number", nullable: true },
          withdrawalAmountMainnet: { type: "number", nullable: true },
        },
      },
      Vote: {
        type: "object",
        properties: {
          chainId: { type: "integer" },
          bountyId: { type: "integer" },
          claimId: { type: "integer" },
          yes: { $ref: "#/components/schemas/BigInteger" },
          no: { $ref: "#/components/schemas/BigInteger" },
          round: { type: "integer" },
        },
      },
      Participation: {
        type: "object",
        properties: {
          userAddress: addressSchema,
          bountyId: { type: "integer" },
          chainId: { type: "integer" },
          amount: { type: "string" },
        },
      },
      Transaction: {
        type: "object",
        properties: {
          tx: { type: "string" },
          index: { type: "integer" },
          bountyId: { type: "integer" },
          claimId: { type: "integer", nullable: true },
          chainId: { type: "integer" },
          address: addressSchema,
          action: { type: "string" },
          timestamp: { $ref: "#/components/schemas/BigInteger" },
        },
      },
      LeaderboardEntry: {
        type: "object",
        properties: {
          address: addressSchema,
          chainId: { type: "integer" },
          earned: { type: "number", nullable: true },
          paid: { type: "number", nullable: true },
          nfts: { type: "number", nullable: true },
        },
      },
      BountyDetail: {
        allOf: [
          { $ref: "#/components/schemas/Bounty" },
          {
            type: "object",
            properties: {
              issuerUser: {
                nullable: true,
                allOf: [{ $ref: "#/components/schemas/User" }],
              },
              claims: {
                type: "array",
                items: { $ref: "#/components/schemas/Claim" },
              },
              participants: {
                type: "array",
                items: { $ref: "#/components/schemas/Participation" },
              },
              votes: {
                type: "array",
                items: { $ref: "#/components/schemas/Vote" },
              },
              transactions: {
                type: "array",
                items: { $ref: "#/components/schemas/Transaction" },
              },
            },
          },
        ],
      },
      ClaimDetail: {
        allOf: [
          { $ref: "#/components/schemas/Claim" },
          {
            type: "object",
            properties: {
              bounty: {
                nullable: true,
                allOf: [{ $ref: "#/components/schemas/Bounty" }],
              },
              issuerUser: {
                nullable: true,
                allOf: [{ $ref: "#/components/schemas/User" }],
              },
              ownerUser: {
                nullable: true,
                allOf: [{ $ref: "#/components/schemas/User" }],
              },
            },
          },
        ],
      },
      UserDetail: {
        allOf: [
          { $ref: "#/components/schemas/User" },
          {
            type: "object",
            properties: {
              bounties: {
                type: "array",
                items: { $ref: "#/components/schemas/Bounty" },
              },
              issuedClaims: {
                type: "array",
                items: { $ref: "#/components/schemas/Claim" },
              },
              ownedClaims: {
                type: "array",
                items: { $ref: "#/components/schemas/Claim" },
              },
              participations: {
                type: "array",
                items: { $ref: "#/components/schemas/Participation" },
              },
              transactions: {
                type: "array",
                items: { $ref: "#/components/schemas/Transaction" },
              },
              leaderboard: {
                type: "array",
                items: { $ref: "#/components/schemas/LeaderboardEntry" },
              },
            },
          },
        ],
      },
    },
  },
};

const app = new Hono();
app.get("/doc", (c) => c.json(document));

export { app as openAPI };
