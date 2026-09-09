# POIDH REST API

Standalone, read-only Hono REST API for POIDH's PostgreSQL data. It uses Drizzle ORM to query tables in PostgreSQL's **`public` schema** and does not depend on Ponder at runtime.

The indexer remains responsible for creating, migrating, and populating the tables. This service only reads and returns that data to API customers.

## Setup

Requires Node.js >= 18.14, pnpm, and PostgreSQL 14+.

```bash
pnpm install --frozen-lockfile
cp .env.local.example .env.local
# Set DATABASE_URL to the indexed PostgreSQL database.
pnpm start
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string; the API reads the `public` schema |
| `PORT` | HTTP port (defaults to `42070`) |
| `REDIS_URL` | Redis connection string (e.g. `redis://localhost:6379/0`); caching is disabled when omitted |

For local development with automatic restarts:

```bash
pnpm dev
```

Run `pnpm typecheck` to check TypeScript and `pnpm test` to run cache tests.

## Redis cache

Set `REDIS_URL` to enable server-side caching of successful JSON GET responses on all data endpoints, including legacy routes. Each full request URL (including filters, pagination, and relations) has a separate cache entry with a fixed **24-hour TTL (86,400 seconds)**. Cache hits do not extend the TTL or query PostgreSQL. Errors, health/readiness checks, and API documentation are not cached.

Data can be up to 24 hours stale, including live/voting status and newly indexed records. Redis failures fall back to PostgreSQL; Redis reconnects automatically. Simultaneous cache misses can still query the database independently.

For local development, start Redis and use `REDIS_URL=redis://localhost:6379/0`:

```bash
docker run --rm --name poidh-redis -p 127.0.0.1:6379:6379 redis:7-alpine redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

Use a private, authenticated Redis service in production (`rediss://` for TLS), with a memory limit and eviction policy. Use a separate Redis database/instance for each environment; entries use the `poidh:rest-api:v1:` prefix.

## Database permissions

Use a PostgreSQL role with read-only access. For example:

```sql
GRANT CONNECT ON DATABASE poidh TO poidh_api;
GRANT USAGE ON SCHEMA public TO poidh_api;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO poidh_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO poidh_api;
```

The final statement applies to future tables created by the role that runs it. Adjust the database and role names for your environment.

The connection pool allows up to 10 connections per API process. Account for all replicas and the indexer when sizing PostgreSQL connection limits.

## API

Interactive documentation is available at `/swagger`; the OpenAPI document is at `/openapi/doc`.

All list endpoints support `limit` (default 50, maximum 100) and `offset`. Every supplied filter is combined with `AND`, so customers can query any useful combination of identifiers, addresses, and statuses.

| Method | Path | Filters / relations |
| --- | --- | --- |
| GET | `/api/v1/bounties` | `chainId`, `id`, `onChainId`, `issuer`, and all status booleans |
| GET | `/api/v1/bounties/:chainId/:bountyId` | `include=issuer,claims,participants,votes,transactions` |
| GET | `/api/v1/claims` | `chainId`, `id`, `onChainId`, `bountyId`, `issuer`, `owner`, `isAccepted`, `isVoting` |
| GET | `/api/v1/claims/:chainId/:claimId` | `include=bounty,issuer,owner` |
| GET | `/api/v1/users` | `address` |
| GET | `/api/v1/users/:address` | Optional `chainId`; `include=bounties,issuedClaims,ownedClaims,participations,transactions,leaderboard` |
| GET | `/api/v1/votes` | `chainId`, `bountyId`, `claimId`, `round` |
| GET | `/api/v1/participations` | `chainId`, `bountyId`, `userAddress` |
| GET | `/api/v1/transactions` | `chainId`, `bountyId`, `claimId`, `index`, `address`, `tx`, `action` |
| GET | `/api/v1/leaderboard` | `chainId`, `address` |
| GET | `/health` | Process liveness |
| GET | `/ready` | Database connectivity |

Detail endpoints include every relation by default. Use `?include=` for only the base record or provide a comma-separated subset. List endpoints return bare JSON arrays; detail endpoints return a JSON object or 404.

The original `/bounty/*`, `/claim/*`, `/live/*`, `/voting/*`, and `/past/*` routes remain available for compatibility.

```bash
# Combine any supported filters
curl 'http://localhost:42070/api/v1/bounties?chainId=8453&inProgress=true&isVoting=false'

# Fetch a complete bounty with all related records
curl 'http://localhost:42070/api/v1/bounties/8453/332'

# Fetch only claims and votes with the bounty
curl 'http://localhost:42070/api/v1/bounties/8453/332?include=claims,votes'

# Fetch all data connected to a user on one chain
curl 'http://localhost:42070/api/v1/users/0xbed82560c39c133a3d64516ecda82c71b72f3cd7?chainId=8453'
```

## Deployment

Deploy this directory as an independent service:

- Install: `pnpm install --frozen-lockfile`
- Start: `pnpm start`
- Health check: `/ready`
- Set `DATABASE_URL`, `PORT`, and `REDIS_URL` to enable caching

No RPC or indexer runtime credentials are required.
