# Internal-Tools Starter

A batteries-included **Turborepo + Next.js 16** starter for internal tools and
small dashboards. Two apps — a public read surface and an admin dashboard — sit
on top of a set of shared packages (auth, db, ui, env, types, storage, logger).

It ships an opinionated baseline so you can skip the boring parts: typed env,
Better Auth with `admin | editor | viewer` roles, Prisma + Postgres with a soft-deleting
example resource, a shadcn design system on design tokens, Vitest + Playwright,
lint/format/commit hooks, and Docker for local Postgres.

> The app's display name comes from `NEXT_PUBLIC_APP_NAME` (default
> **"Internal Tools"**) — it is never hardcoded. Set it per project.

> Full prose docs live in [`docs/`](./docs/README.md). New here? Start with the
> [Starter guide](./docs/00-starter-guide.md).

## Stack

| Concern    | Choice                                                | Notes                                                                          |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Monorepo   | **Turborepo** + pnpm workspaces                       | Cached builds, internal `workspace:*` deps, no package build step              |
| Framework  | Next.js 16 (App Router, Server Components) + React 19 | `proxy.ts` replaces `middleware.ts` (post-CVE-2025-29927)                      |
| Auth       | **Better Auth 1.7** + `admin` plugin                  | Prisma adapter, DB sessions (instant revoke), email/password + optional Google |
| Database   | **Postgres** via **Prisma 7** + `@prisma/adapter-pg`  | Works with Docker / Neon / Supabase / RDS. PostGIS lives on `feat/geo`.        |
| Validation | **Zod** + `@t3-oss/env-*`                             | One schema is the source of truth for env and domain types                     |
| Styling    | **Tailwind CSS 4** + `@repo/ui` design tokens         | oklch palette, shadcn components rewritten to semantic tokens                  |
| Lint/fmt   | **oxlint** + **oxfmt**                                | Fast Rust toolchain (NOT eslint/prettier)                                      |
| Tests      | **Vitest** (unit) + **Playwright** (e2e)              | Unit tests live next to package source; e2e in `e2e/`                          |
| Hooks      | **lefthook** + **commitlint**                         | Pre-commit oxlint/oxfmt on staged files; Conventional Commits                  |
| Logging    | **pino** (`@repo/logger`)                             | Structured JSON, bundler-safe                                                  |
| Errors     | **Sentry** (optional)                                 | No-op without `NEXT_PUBLIC_SENTRY_DSN`                                         |

## Quickstart (about 60 seconds)

```bash
# 1. Create your repo from this template (GitHub "Use this template") and clone it.
git clone <your-new-repo> my-app && cd my-app

# 2. Install. pnpm workspaces link the @repo/* packages — no build step.
pnpm install

# 3. Rename the scope/slug/app name for your project (see the Starter guide).
#    Swaps @repo → @yourscope and sets the display name across the workspace.

# 4. Configure env. Each context has its own .env.example.
cp apps/web/.env.example     apps/web/.env.local
cp apps/admin/.env.example   apps/admin/.env.local
cp packages/db/.env.example  packages/db/.env.local
#    Generate a Better Auth secret and paste it into BOTH app env files:
openssl rand -base64 32

# 5. Start local Postgres (Docker), apply migrations, seed example data.
docker compose up -d db
pnpm db:migrate
pnpm db:seed

# 6. Run both apps.
pnpm dev
```

Open:

- Public web app — http://localhost:3000
- Admin dashboard — http://localhost:3001

The **public web app works without a database**: if `DATABASE_URL` is unset it
falls back to the seed dataset (`@repo/db/seed-data`), so a fresh clone boots
with zero setup. The admin dashboard and any real DB query need `DATABASE_URL`.

### First admin user

Public sign-up is disabled, so create the first admin from the CLI (it prints
a temporary password; re-running it on an existing email promotes that account):

```bash
pnpm auth:create-admin you@example.com "Your Name"
```

Then sign in at http://localhost:3001/sign-in.

## Monorepo layout

```
.
├── apps/
│   ├── web/      Public app             → http://localhost:3000
│   └── admin/    Admin dashboard        → http://localhost:3001
└── packages/
    ├── ui/         Design tokens (oklch) + shared shadcn components
    ├── db/         Prisma schema, typed queries, seed + DB-less fallback
    ├── auth/       Better Auth: server, client, Next.js handler + requireAdmin()
    ├── env/        Typesafe env (@t3-oss/env-core + env-nextjs), per-concern modules
    ├── types/      Zod schemas + shared domain types
    ├── storage/    Optional S3/R2 helpers (presigned uploads)
    ├── logger/     pino structured logger
    └── tsconfig/   Shared TypeScript configs
```

### Dependency direction

`apps/*` depend on `packages/*`, never the reverse. Within packages the rough
order is `tsconfig` / `env` → `types` → `db` → `auth`; `ui`, `storage`, and
`logger` are leaves. No circular dependencies.

Internal packages have **no build step** — they're consumed as TypeScript
source, which Turbopack transpiles automatically for workspace packages. Edits
in `packages/*` show up in apps without rebuilding. `@repo/db` is the exception:
its `build` script runs `prisma generate`.

## The example domain

The template ships one generic resource, **`Item`** (title, description, a
`draft | active | archived` status, optional owner, soft-delete via
`deletedAt`). It exercises the whole CRUD path — admin pages, Server Actions,
typed queries, a public list/detail view, and the DB-less fallback — so you can
see the pattern end to end. Replace `Item` with your real model(s) and reseed.

## Commands

Run from the repo root — Turborepo handles cross-package ordering.

```bash
pnpm dev              # both apps in parallel
pnpm dev:web          # public app only
pnpm dev:admin        # admin dashboard only

pnpm build            # build all packages + apps (topological)
pnpm typecheck        # tsc --noEmit across the workspace
pnpm test             # Vitest unit tests
pnpm lint             # oxlint   (NOT eslint)
pnpm format           # oxfmt    (NOT prettier)
pnpm lint:fix
pnpm format:fix

pnpm db:generate      # prisma generate
pnpm db:migrate:dev   # prisma migrate dev (author a new migration)
pnpm db:migrate       # prisma migrate deploy (apply pending migrations)
pnpm db:seed          # idempotent — re-runnable
pnpm db:studio        # Prisma Studio
pnpm auth:gen-schema  # regenerate the Better Auth schema after plugin changes

# Single-workspace operations:
pnpm --filter @repo/web add some-package
pnpm turbo run build --filter=@repo/web    # one app + its deps
```

Requires **Node ≥ 24** and **pnpm 9.15**.

## Documentation

| Topic                                                  | Doc                                                       |
| ------------------------------------------------------ | --------------------------------------------------------- |
| Starting a new project from this template              | [Starter guide](./docs/00-starter-guide.md)               |
| Monorepo layout, package boundaries, request flows     | [Architecture](./docs/01-architecture.md)                 |
| First-time setup, env, DB bootstrap, troubleshooting   | [Getting started](./docs/02-getting-started.md)           |
| Prisma schema, adapter, migrations, seeding            | [Database](./docs/03-database.md)                         |
| Better Auth config, roles, route protection, sessions  | [Authentication](./docs/04-authentication.md)             |
| Design tokens, typography, anti-patterns               | [Design system](./docs/06-design-system.md)               |
| HTTP endpoints + Server Action surface                 | [API reference](./docs/07-api-reference.md)               |
| Hosting, env per stage, build pipeline, OAuth          | [Deployment](./docs/08-deployment.md)                     |
| Day-to-day recipes (add table, route, component, etc.) | [Development workflow](./docs/09-development-workflow.md) |
| Contributing                                           | [CONTRIBUTING.md](./CONTRIBUTING.md)                      |
