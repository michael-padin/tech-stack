# Database

The template uses **plain Postgres** via **Prisma 7** with the
`@prisma/adapter-pg` (node-postgres) driver. This document covers the schema,
conventions, migrations, and seeding.

> The base template is **non-spatial**. PostGIS — `Unsupported(...)` geometry
> columns and the `ST_*` raw-query conventions — lives on the `feat/geo` branch.
> See [Starter guide — maps / PostGIS](./00-starter-guide.md#6-pulling-in-maps--postgis-featgeo).

## Why Prisma + `@prisma/adapter-pg`?

- **Standard Postgres, anywhere.** `@prisma/adapter-pg` speaks to any
  vanilla Postgres — local Docker, Neon, Supabase, RDS, Railway. No
  provider lock-in. (For Neon's serverless WebSocket driver on edge runtimes,
  swap to `@prisma/adapter-neon`; see [Connection management](#connection-management).)
- **Typed core API + `$queryRaw`.** Prisma covers CRUD with full types;
  anything bespoke drops to `prisma.$queryRaw<Row[]>` / `$executeRaw` with
  tagged template literals so SQL injection isn't a concern.
- **One schema file.** `packages/db/prisma/schema.prisma` is the single source
  of truth for models, enums, indexes, and relations.

## Schema overview

Everything lives in `packages/db/prisma/schema.prisma`, grouped with comments:

| Section       | Models                                       | Purpose                                                 |
| ------------- | -------------------------------------------- | ------------------------------------------------------- |
| Enums         | `item_status`, `app_role`                    | Postgres enums (`app_role` = `admin`/`editor`/`viewer`) |
| Better Auth   | `user`, `session`, `account`, `verification` | Better Auth tables — keep verbatim                      |
| Example model | `items` (`Item`)                             | The generic CRUD resource — replace with your own       |
| Audit         | `audit_log` (`AuditLog`)                     | Append-only record of who did what                      |

The Prisma client is generated to `packages/db/generated/` (not `node_modules`),
configured via `generator client { output = "../generated" }`.

### The example `Item` model

```prisma
model Item {
  id          String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title       String     @db.VarChar(200)
  description String?    @db.VarChar(2000)
  status      ItemStatus @default(draft)
  ownerId     String?    @map("owner_id")
  deletedAt   DateTime?  @map("deleted_at") @db.Timestamp(6)
  createdAt   DateTime   @default(now())  @map("created_at") @db.Timestamp(6)
  updatedAt   DateTime   @updatedAt        @map("updated_at") @db.Timestamp(6)

  owner User? @relation("items_owner", fields: [ownerId], references: [id], onDelete: SetNull)

  @@index([status],    map: "idx_items_status")
  @@index([ownerId],   map: "idx_items_owner")
  @@index([deletedAt], map: "idx_items_deleted")
  @@map("items")
}

enum ItemStatus {
  draft
  active
  archived
  @@map("item_status")
}
```

It demonstrates the patterns this template leans on:

- **A status enum** (`draft | active | archived`) — mirrored as a Zod enum in
  `@repo/types` (`itemStatusSchema`) so the same values type the UI and validate
  input.
- **An optional owner relation** — `onDelete: SetNull` keeps items when a user
  is deleted.
- **Soft delete** — `deletedAt` is set instead of removing the row. Every read
  excludes soft-deleted rows (`WHERE deleted_at IS NULL`).

Replace `Item` with your real model(s); the auth tables stay.

### The `AuditLog` model

`AuditLog` (table `audit_log`) is an **append-only** record of who did what —
the foundation features like item history and a moderation trail build on:

```prisma
model AuditLog {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  actorId    String?  @map("actor_id")     // optional relation to User
  actorEmail String?  @map("actor_email")  // denormalized — survives user deletion
  action     String   @db.VarChar(100)     // e.g. "item.create"
  entity     String   @db.VarChar(100)     // e.g. "Item"
  entityId   String?  @map("entity_id")
  summary    String?  @db.VarChar(500)
  metadata   Json?    @db.JsonB
  before     Json?    @db.JsonB            // pre-change snapshot (for diffs)
  after      Json?    @db.JsonB            // post-change snapshot
  ipAddress  String?  @map("ip_address")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  actor User? @relation("audit_actor", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([entity, entityId], map: "idx_audit_entity")
  @@index([createdAt],        map: "idx_audit_created")
  @@index([actorId],          map: "idx_audit_actor")
  @@map("audit_log")
}
```

Design notes:

- **`actorId` is `onDelete: SetNull`** and **`actorEmail` is denormalized** —
  the log row outlives the user it references, keeping the historical record
  intact after a `removeUser`.
- **JSON columns** (`metadata`, `before`, `after`) are free-form. The query
  layer surfaces them as `unknown` at the serialized boundary — callers narrow
  before use (never `any`).
- **No soft-delete.** Audit rows are the historical record; they aren't deleted.

Write with `recordAudit(input)` and read with `listAuditLogs(filters, page)` from
`@repo/db` (see [Queries](#queries)). `recordAudit` is meant to be called from
Server Actions after a mutation.

## The typed-row convention (`$queryRaw<Row[]>`)

For anything the typed Prisma API can't express, drop to raw SQL — but **always
type the result** with a row generic. Never use `any`:

```ts
import { prisma } from "@repo/db/client";

const rows = await prisma.$queryRaw<Array<{ status: string; count: number }>>`
  SELECT status, count(*)::int AS count
  FROM items
  WHERE deleted_at IS NULL
  GROUP BY status
`;
```

`${...}` interpolations in a tagged template literal are parameterized — there's
no SQL-injection hazard. This convention still applies on the `feat/geo` branch
for `ST_*` spatial queries.

## Migrations

```bash
# In development — author a new migration after editing schema.prisma:
pnpm db:migrate:dev      # prisma migrate dev

# In CI / production — apply pending migrations:
pnpm db:migrate          # prisma migrate deploy

# Regenerate the Prisma Client after pulling new migrations:
pnpm db:generate         # prisma generate

# Inspect the database in a UI:
pnpm db:studio           # prisma studio

# Prototyping only — push schema directly without authoring a migration:
pnpm db:push             # prisma db push
```

> These scripts run through `pnpm with-env` (dotenv-cli) so the root
> `.env.local` populates `DATABASE_URL` before Prisma evaluates. Migration
> paths and the datasource URL are configured in `packages/db/prisma.config.ts`.
> See [Stage-scoped commands](#stage-scoped-commands) below for staging/
> production variants that read `.env.staging` / `.env.production` instead.

### The initial migration

`packages/db/prisma/migrations/00000000000000_init/migration.sql` is the
bootstrap. It creates the enums (`item_status`, `app_role`), the Better Auth
tables, the `items` table, all indexes, and the foreign keys. `items.id`
defaults to `gen_random_uuid()` — available in core Postgres 13+ (no extension
needed).

When you migrate a brand-new database, this file runs first via
`prisma migrate deploy`.

Subsequent migrations follow in timestamp order. `…_rbac_and_audit` adds the
`editor`/`viewer` values to `app_role` and creates the `audit_log` table (with
its indexes and the `actor_id → user.id` foreign key). Note that
`ALTER TYPE … ADD VALUE` can't run inside the same transaction that uses the new
value, so enum additions and the rest are separate statements — Prisma's
`migrate dev` lays this out for you.

## Seeding

The seed (`packages/db/src/seed/run.ts`) upserts the example rows defined in
`packages/db/src/seed/example-data.ts`:

```bash
pnpm db:seed
```

It's **idempotent** — `Item` has no natural unique key, so the script
find-or-updates by `title`. Re-running never duplicates rows.

The same `example-data.ts` module powers the **DB-less fallback**: its
`fallbackItems()` function produces a synthetic `Item[]` that `apps/web/lib/db.ts`
serves when `DATABASE_URL` is unset (exported as `@repo/db/seed-data`). Keep the
two uses in sync — edit one file, both the seed and the fallback update.

### Replacing the example data

When you swap in your own model, edit `example-data.ts` (both the seed array and
`fallbackItems()`), then re-run `pnpm db:seed`.

## Stage-scoped commands

The default `db:*` commands (`db:migrate`, `db:seed`, `db:studio`, …) read the
root `.env.local` via `dotenv-cli` — your local database. For staging and
production, use the stage-scoped variants instead:

```bash
pnpm db:migrate:staging   # prisma migrate deploy, reads root .env.staging
pnpm db:migrate:prod      # prisma migrate deploy, reads root .env.production

pnpm db:seed:staging      # idempotent seed against staging (sets SEED_ALLOW_REMOTE=true)

pnpm db:studio:staging    # prisma studio against staging
pnpm db:studio:prod       # prisma studio against production

pnpm db:reset             # prisma migrate reset, local
pnpm db:reset:staging     # prisma migrate reset, staging
```

Each `:staging` / `:prod` script points `dotenv-cli` at a different root env
file (`.env.staging` / `.env.production` instead of `.env.local`) — see
`packages/db/package.json`'s `with-env:staging` / `with-env:prod` scripts.
Both files are gitignored; create them locally (copied from the root
`.env.example`) when you need to run a stage command from your machine, or
supply the same variables through your host platform's environment settings.

**There's no `db:seed:prod` or `db:reset:prod`.** Seeding or resetting
production is dangerous enough that it's deliberately not a one-liner — the
demo seed is example data, not something you want live on a production
database by accident. If you genuinely need it, run `db:seed` with
`SEED_ALLOW_REMOTE=true` and a production `DATABASE_URL` by hand.

The seed script (`packages/db/src/seed/run.ts`) has a safety rail:
`isLocalDatabase()` checks that `DATABASE_URL` points at `localhost`, a
loopback address, or `host.docker.internal`. Seeding anything else throws
unless `SEED_ALLOW_REMOTE=true` is set — which `db:seed:staging` sets for you.
This guards against accidentally running example data into a real database.

## Queries

Typed query helpers live in `packages/db/src/queries/`. Add new ones there
rather than putting raw SQL in route handlers or actions — both apps share them.

```ts
import { listItems, getItemById, createItem } from "@repo/db/queries/items";

const items = await listItems({ status: "active", sort: "recent" });
```

The query layer keeps a single source of truth for the serialized shape:

- `listItems(filters)` / `getItemById(id)` — public reads; soft-deleted rows are
  always excluded. Dates are serialized to ISO strings so the payload crosses
  the server/client boundary cleanly.
- `listItemsPaginated(filters, page)` — admin list reads; returns a
  `Paginated<Item>` envelope (`rows`, `total`, `page`, `pageSize`, `pageCount`).
- `createItem` / `updateItem` / `softDeleteItem` — mutations used by the admin
  Server Actions.
- `getAdminSummary()` — dashboard aggregates (per-status counts via `groupBy`).
- `recordAudit(input)` / `listAuditLogs(filters, page)` — append + paginated
  read for the `AuditLog` model (newest first). `listAuditLogs` returns the same
  `Paginated<T>` envelope as `listItemsPaginated`.

Filters and pagination are typed by Zod schemas in `@repo/types`
(`itemFilterSchema`, `auditLogFilterSchema`, `pageQuerySchema`).

## Connection management

`prisma` (exported from `@repo/db`) is a lazily-initialized singleton. It uses
`@prisma/adapter-pg` against the connection string from `@repo/db/keys`:

```ts
import { prisma } from "@repo/db/client";

export async function GET() {
  const items = await prisma.item.findMany({ where: { deletedAt: null }, take: 10 });
  return Response.json(items);
}
```

In development the client is cached on `globalThis` so Next.js's hot reload
doesn't open a new pool on every change. For long-running scripts (seeds, one-off
jobs), call `await prisma.$disconnect()` at the end so the process exits cleanly
(the seed script already does this).

### Swapping the driver for Neon serverless

If you deploy to an edge runtime on Neon and want their WebSocket driver, swap
the adapter in `packages/db/src/client.ts`:

```ts
import { PrismaNeon } from "@prisma/adapter-neon";
// const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
```

For standard Node deployments (Vercel serverless functions, a container, etc.),
`@prisma/adapter-pg` is the right default.

## Row-level security

RLS is **optional** — Better Auth handles identity at the application layer
(`requireAdmin()` in Server Components, route handlers, and Server Actions). If
you want RLS as defense-in-depth, write the policies as raw SQL in a new Prisma
migration and set a per-request session variable before running queries.
