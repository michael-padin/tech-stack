# Deployment

Two Next.js apps + a Postgres database. This document covers hosting,
environment promotion, and the build pipeline.

## Hosting topology

```
                    ┌──────────────────┐
                    │   DNS / CDN      │  (Cloudflare, Vercel, etc.)
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
       ┌────────────────┐         ┌────────────────┐
       │ apps/web       │         │ apps/admin     │
       │ app.X.com      │         │ admin.X.com    │
       └────────┬───────┘         └────────┬───────┘
                │                          │
                └────────────┬─────────────┘
                             ▼
                    ┌────────────────┐
                    │   Postgres     │
                    │  (Neon /       │
                    │   Supabase /   │
                    │   RDS / …)     │
                    └────────────────┘
```

Both apps deploy independently. They share the database and the same
`BETTER_AUTH_SECRET`.

## Recommended platforms

| Component          | Recommendation                                      | Why                                           |
| ------------------ | --------------------------------------------------- | --------------------------------------------- |
| **apps/web**       | Vercel                                              | First-class Next.js 16 support, edge caching  |
| **apps/admin**     | Vercel                                              | Same                                          |
| **Database**       | Any managed Postgres (Neon, Supabase, RDS, Railway) | `@prisma/adapter-pg` speaks standard Postgres |
| **DNS**            | Cloudflare (or your registrar)                      | Per-subdomain rules                           |
| **Object storage** | Cloudflare R2 / any S3 (optional)                   | Only if `@repo/storage` is in use             |
| **Error tracking** | Sentry (optional)                                   | No-op without a DSN                           |

> The base template is non-spatial. If your project pulls in the `feat/geo`
> branch, the database must have **PostGIS** available as an extension.

## Environment per stage

| Stage      | apps/web URL          | apps/admin URL        | DB                        |
| ---------- | --------------------- | --------------------- | ------------------------- |
| Local      | http://localhost:3000 | http://localhost:3001 | Local Docker / dev DB     |
| Preview    | <branch>.app.X.com    | <branch>.admin.X.com  | Ephemeral branch / dev DB |
| Production | app.X.com             | admin.X.com           | Production DB             |

### Required env vars per app

**apps/admin**

| Variable                             | Notes                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| `DATABASE_URL`                       | Required                                               |
| `BETTER_AUTH_SECRET`                 | Required — **must match apps/web in the same env**     |
| `BETTER_AUTH_URL`                    | Admin's canonical URL                                  |
| `GOOGLE_CLIENT_ID` / `_SECRET`       | Optional (both → enables Google sign-in)               |
| `NEXT_PUBLIC_APP_NAME`               | Display name                                           |
| `REVALIDATE_SECRET`                  | Optional — must match apps/web to invalidate its cache |
| `NEXT_PUBLIC_WEB_URL`                | Optional — target for cache revalidation               |
| `NEXT_PUBLIC_SENTRY_DSN`             | Optional                                               |
| `R2_*` / `NEXT_PUBLIC_R2_PUBLIC_URL` | Optional — only if `@repo/storage` is used             |

**apps/web**

| Variable                    | Notes                                               |
| --------------------------- | --------------------------------------------------- |
| `DATABASE_URL`              | Optional — unset falls back to `@repo/db/seed-data` |
| `NEXT_PUBLIC_APP_NAME`      | Display name                                        |
| `NEXT_PUBLIC_SITE_URL`      | Canonical public URL (OpenGraph, sitemap)           |
| `NEXT_PUBLIC_ADMIN_URL`     | Optional — shows the "Manage" link                  |
| `REVALIDATE_SECRET`         | Optional — must match apps/admin                    |
| `NEXT_PUBLIC_SENTRY_DSN`    | Optional                                            |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Optional — only if serving stored images            |

> **Critical:** `BETTER_AUTH_SECRET` must match between `apps/web` and
> `apps/admin` of the same environment, or sessions won't validate cross-app.

The full reference is the root [`.env.example`](../.env.example). All vars are
read through `@repo/env/*` and validated at boot.

### Env file model

Env vars are centralized at the repo root rather than duplicated per app:

- **Root `.env.local`** — shared by `apps/web`, `apps/admin`, and the Prisma
  CLI tooling. This is where `DATABASE_URL`, `BETTER_AUTH_SECRET`, and every
  other cross-app value live locally.
- **`apps/<app>/.env.local`** — optional, per-app overrides only (e.g.
  admin's `BETTER_AUTH_URL`, since it differs by app). Each app's `dev` script
  loads its own `apps/<app>/.env.local` FIRST, then root `.env.local` — the
  per-app file wins on duplicate keys, root fills in the rest.
- **`.env.staging` / `.env.production`** (root) — per-stage secrets, read by
  the `db:*:staging` / `db:*:prod` commands (see
  [Database — stage-scoped commands](./03-database.md#stage-scoped-commands)).
  Both are gitignored — **never commit them**. Populate them locally when you
  need to run a stage DB command from your machine, or provide the same
  variables through your host platform's environment settings for the actual
  app deploys (Vercel project env vars, etc.) — the platform doesn't read
  these files.

On a hosted platform (Vercel, etc.), set env vars in the platform's project
settings per environment (Production / Preview / Development) rather than
relying on any `.env*` file — those files are for local dev and for driving
the `db:*:staging` / `db:*:prod` CLI commands from your machine.

## Cookie domain (cross-app SSO)

To let users sign in on either app once, set the cookie domain in production:

```ts
// packages/auth/src/server.ts
advanced: {
  crossSubDomainCookies: {
    enabled: process.env.NODE_ENV === "production",
    domain: ".example.com",
  },
},
```

## Build pipeline

### Vercel

Each app is a separate Vercel project, imported from the same repo
([Vercel: Using monorepos](https://vercel.com/docs/monorepos)):

```
Root directory:        apps/web    (or apps/admin)
Framework preset:      Next.js
Build command:         turbo run build
Output directory:      (framework default)
```

Vercel runs a global `turbo` and infers `--filter` from the root directory, so
`turbo run build` builds only that app and the packages it depends on
(`@repo/db`'s `build` generates the Prisma client on the way).

**Skipping unaffected projects is automatic**: a push that touches only
`apps/admin` doesn't build `apps/web`. It relies on each package having a
unique `name` and declaring its workspace dependencies in `package.json` — both
true here, and `pnpm boundaries` keeps the graph honest.

**Optional: filtered installs.** To install only one app's dependency tree, set
the project's install command to `pnpm install --filter @repo/web...` (or
`@repo/admin...`).

**Optional: Related Projects.** The admin app calls the web app's
`/api/revalidate`, using `NEXT_PUBLIC_WEB_URL`. To point each admin _preview_
at the matching web preview automatically, add the web project's ID to
`apps/admin/vercel.json` (`{ "relatedProjects": ["prj_..."] }`), read it with
`@vercel/related-projects`' `withRelatedProject({ projectName, defaultHost })`
in `apps/admin/lib/revalidate-web.ts`, and add `VERCEL_RELATED_PROJECTS` to
`turbo.json`'s `globalPassThroughEnv`
([Vercel: Related Projects](https://vercel.com/docs/monorepos#how-to-link-projects-together-in-a-monorepo)).

> Set `SKIP_ENV_VALIDATION=1` in the build environment so the Zod env schemas
> don't fail the build when runtime secrets aren't injected at build time.

#### Remote caching

```bash
npx turbo login
npx turbo link
```

On Vercel, remote caching is on by default. For GitHub Actions, add
`TURBO_TOKEN` (a Vercel access token) as a repository secret and `TURBO_TEAM`
(your team slug) as a repository variable — `ci.yml` already passes both, and
without them Turborepo just uses its local cache.

### Self-hosted

```bash
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@repo/web
cd apps/web && pnpm start
```

## Database migrations in CI

Run a deploy step **before** the apps deploy:

```bash
DATABASE_URL=$PROD_DATABASE_URL pnpm db:migrate     # prisma migrate deploy
```

This applies pending migrations from `packages/db/prisma/migrations/`. The seed
(`pnpm db:seed`) is idempotent, so it's safe to re-run, though you typically only
run it on initial bootstrap.

Running the same commands from your own machine against staging or production
(rather than injecting `DATABASE_URL` inline), use the stage-scoped variants,
which read `.env.staging` / `.env.production` at the root:

```bash
pnpm db:migrate:staging   # prisma migrate deploy against staging
pnpm db:migrate:prod      # prisma migrate deploy against production
pnpm db:seed:staging      # idempotent seed against staging only — no db:seed:prod
```

See [Database — stage-scoped commands](./03-database.md#stage-scoped-commands)
for the full list and the `SEED_ALLOW_REMOTE` safety rail that guards the demo
seed against running on a non-local database by accident.

### Branching strategy (if your provider supports DB branches)

1. Each PR gets a database branch.
2. The preview deploy points at that branch's `DATABASE_URL`.
3. Migrations apply on the branch.
4. On merge, migrations apply to the main database.

Breaking schema changes never touch production until merge.

## CI

`.github/workflows/ci.yml` runs on push to the default branch and on PRs:
install (frozen lockfile) → `pnpm lint` → `pnpm typecheck` → `pnpm test`. It sets
a placeholder `DATABASE_URL` so env validation passes.

## OAuth setup (Google)

In Google Cloud Console:

1. Create an OAuth 2.0 Client ID.
2. Authorized JavaScript origins: your app + admin URLs (and the localhost
   equivalents for dev).
3. Authorized redirect URIs:
   - `https://admin.example.com/api/auth/callback/google`
   - `http://localhost:3001/api/auth/callback/google` (dev)

Set the resulting client ID and secret in the admin app's env (and the web app's
too if you enable Google there).

## Observability

- **Sentry** — set `NEXT_PUBLIC_SENTRY_DSN` to enable; unset = no-op. The
  instrumentation files (`instrumentation.ts`, `instrumentation-client.ts`)
  already wire `register()` / `onRequestError` / `onRouterTransitionStart`.
- **Logging** — `@repo/logger` (pino) emits structured JSON to stdout; the
  platform's log collector parses it. Tune verbosity with `LOG_LEVEL`.

## Rollback

1. **Vercel** — instant rollback via the dashboard.
2. **A bad migration** — Prisma migrations are forward-only; write a new
   reversing migration. Author it as a new directory under `prisma/migrations/`.
3. **Auth secret rotation** — bump `BETTER_AUTH_SECRET`; all sessions invalidate
   on next request as cookie signatures stop matching.

## Pre-launch checklist

- [ ] Migrations applied against the production DB (`pnpm db:migrate`)
- [ ] First admin user created (sign up, or promote via SQL)
- [ ] `BETTER_AUTH_SECRET` matches between web and admin in prod
- [ ] `NEXT_PUBLIC_APP_NAME` set to your product name
- [ ] Google OAuth redirect URIs include production URLs (if used)
- [ ] `REVALIDATE_SECRET` matches across apps (if cross-app revalidation is used)
- [ ] Cookie domain set to the parent domain if cross-app SSO is desired
- [ ] `SKIP_ENV_VALIDATION=1` set in the build environment
- [ ] `noindex` on the admin app; `robots.txt` / `sitemap` on the public app
- [ ] Sentry DSN set (if using error tracking)
- [ ] Backup retention confirmed at the DB provider
