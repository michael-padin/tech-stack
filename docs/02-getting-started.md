# Getting started

This guide takes you from a fresh `git clone` to two running apps with example
data in a local Postgres.

> Starting a real project? Read the [Starter guide](./00-starter-guide.md)
> first — it covers renaming the scope and display name. This page is about
> running the template as it ships.

## Prerequisites

- **Node.js ≥ 24** — `node --version` (an `.nvmrc` pins the exact version)
- **pnpm 9.15** — `corepack enable` or `npm i -g pnpm@9.15.0`
- **Docker** _(recommended)_ — for local Postgres via `docker-compose.yml`.
  Any Postgres (Neon, Supabase, RDS, …) works too.

## 1. Install

```bash
pnpm install
```

This installs all workspaces and links the `@repo/*` packages — they're
importable with no build step. It also installs the lefthook git hooks.

## 2. Start a database (optional for the web app)

The public web app runs **without** a database — it falls back to the example
dataset (`@repo/db/seed-data`). The admin dashboard and any real DB read need
one. Spin up local Postgres with Docker:

```bash
docker compose up -d db
```

This starts `postgres:16` on `localhost:5432` with database `app`, matching the
default `DATABASE_URL` in the `.env.example` files:

```
postgresql://postgres:postgres@localhost:5432/app?schema=public
```

> Prefer a hosted database? Use your provider's connection string instead. The
> Prisma client uses `@prisma/adapter-pg` (node-postgres), which speaks to any
> standard Postgres.

## 3. Configure environment

Env vars are centralized at the repo root — one shared `.env.local` for both
apps and the Prisma CLI tooling, plus optional per-app override files. Copy
the shared template first:

```bash
cp .env.example  .env.local
```

Then fill in the values. The most important keys:

```dotenv
# Required for the admin app (and any real DB read/write). Optional for
# apps/web — unset falls back to the example dataset.
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app?schema=public

# Better Auth secret — generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=<32+ random bytes>

NEXT_PUBLIC_APP_NAME=Internal Tools
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Each app's `dev` script loads its own `apps/<app>/.env.local` FIRST (if
present), then the root `.env.local` — so per-app values override the shared
ones, and the shared file fills in everything else. `apps/web/.env.local` is
optional; `apps/admin/.env.local` needs exactly one override, its own
`BETTER_AUTH_URL`:

```bash
cp apps/admin/.env.example  apps/admin/.env.local
```

```dotenv
# apps/admin/.env.local — differs from apps/web, so it can't live in the
# shared root file.
BETTER_AUTH_URL=http://localhost:3001
```

The Prisma CLI (`pnpm db:generate` / `db:migrate` / `db:seed` / `db:studio`)
also reads the root `.env.local` via `dotenv-cli` — no separate file needed
for local dev. (Staging/production DB commands read `.env.staging` /
`.env.production` at the root instead — see
[Database — stage-scoped commands](./03-database.md#stage-scoped-commands).)

> Env values are validated against Zod schemas (`@t3-oss/env-core` +
> `@t3-oss/env-nextjs`). Each package owns its schema (`@repo/db/keys`,
> `@repo/auth/keys`, `@repo/storage/keys`); each app's `env.ts` composes the
> ones it uses and is loaded by `next.config.ts`, so a bad value fails the
> build. Cross-app config lives in `@repo/env/client` (the `NEXT_PUBLIC_*` one),
> `@repo/env/features` (server-only feature flags) and `@repo/env/revalidate`.
> Don't read `process.env.*` directly.

The full variable reference is the root [`.env.example`](../.env.example).

## 4. Set up the database

You only need this once (or after a schema change):

```bash
# 4a. Generate the Prisma Client from packages/db/prisma/schema.prisma
pnpm db:generate

# 4b. Apply migrations — creates all tables, enums, and indexes.
pnpm db:migrate          # prisma migrate deploy

# 4c. Seed example Item rows (idempotent — re-runnable)
pnpm db:seed
```

## 5. Run the apps

```bash
pnpm dev          # both apps in parallel via Turborepo
pnpm dev:web      # public app only
pnpm dev:admin    # admin dashboard only
```

Open:

- Public app — http://localhost:3000
- Admin dashboard — http://localhost:3001

## 6. Create your first admin user

The admin dashboard requires the `admin` role. Public sign-up is disabled, so create the first admin from the CLI (it prints
a temporary password; re-running it on an existing email promotes that account):

```bash
pnpm auth:create-admin you@example.com "Your Name"
```

Then sign in at http://localhost:3001/sign-in.

If you ever need to promote an account by hand:

```bash
psql "$DATABASE_URL" -c "UPDATE \"user\" SET role = 'admin' WHERE email = 'you@example.com';"
# Sign out and back in to refresh the session.
```

## Common issues

### `Cannot find module '@repo/...'`

Run `pnpm install` again from the repo root. pnpm workspaces link the packages
on install; if you skipped it, the symlinks are missing.

### `relation "items" does not exist`

You haven't run `pnpm db:migrate` yet, or it failed. Re-run it and look for
errors. Confirm the database is reachable (`docker compose ps`).

### `Can't reach database server at localhost:5432`

The Docker container isn't running. Start it with `docker compose up -d db`, or
point `DATABASE_URL` at a database that is running.

### "Better Auth secret too short"

`BETTER_AUTH_SECRET` must be ≥ 32 bytes. Generate one with
`openssl rand -base64 32` and restart the dev server after editing `.env.local`.

### The public app shows example data even though I set `DATABASE_URL`

`DATABASE_URL` belongs in the root `.env.local` (or `apps/web/.env.local` if
you're overriding it per app). Restart the dev server after editing env
files — the `dotenv -e` wrapper in each app's `dev` script only reads them
at process start.

## Next steps

- Read [Architecture](./01-architecture.md) for the big picture
- Read [Authentication](./04-authentication.md) before adding protected routes
- Read [Database](./03-database.md) before changing the schema
