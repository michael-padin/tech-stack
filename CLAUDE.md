# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What this is

An **Internal-Tools Starter** — a Turborepo monorepo template for internal
tools and small dashboards. Two Next.js 16 apps (`@repo/web` public app on
:3000, `@repo/admin` dashboard on :3001) sit on top of shared packages under
`packages/*`. The example domain is a generic `Item` resource; replace it with
your real model(s).

The package scope is `@repo/*`. When starting a real project, run the rename
flow to swap it for your own scope (see [`docs/00-starter-guide.md`](./docs/00-starter-guide.md)).

Full prose docs live in [`docs/`](./docs/). When working on a specific area,
read the matching doc — they go deeper than this file.

## Commands

Run from the repo root. Turborepo handles cross-package ordering.

```bash
pnpm dev              # both apps in parallel
pnpm dev:web          # public app only
pnpm dev:admin        # admin dashboard only

pnpm build            # all packages + apps (topological)
pnpm typecheck        # tsc --noEmit across the workspace
pnpm test             # Vitest unit tests
pnpm lint             # oxlint  (NOT eslint)
pnpm format           # oxfmt   (NOT prettier)
pnpm lint:fix
pnpm format:fix

pnpm db:generate      # prisma generate
pnpm db:migrate:dev   # prisma migrate dev (author new migration in dev)
pnpm db:migrate       # prisma migrate deploy (prod)
pnpm db:seed          # idempotent — re-runnable
pnpm db:studio
pnpm auth:gen-schema  # regenerate auth schema after plugin changes

# Stage-scoped DB tooling (reads root .env.staging / .env.production):
pnpm db:migrate:staging
pnpm db:migrate:prod
pnpm db:seed:staging     # sets SEED_ALLOW_REMOTE=true — no db:seed:prod (dangerous by design)
pnpm db:studio:staging
pnpm db:studio:prod
pnpm db:reset            # prisma migrate reset (local)
pnpm db:reset:staging

# Local Postgres via Docker:
docker compose up -d db

# Single-workspace operations:
pnpm --filter @repo/web add some-package
pnpm --filter @repo/db studio
pnpm turbo run build --filter=@repo/web    # one app + its deps
```

Node ≥ 24, pnpm 9.15. Roles are `admin | editor | viewer` (capability map in
`@repo/auth`; public sign-up is off, `defaultRole` is `viewer`, and the first
admin comes from `pnpm auth:create-admin <email> "<name>"`). Unit tests run on Vitest (`pnpm test`); e2e on Playwright (specs in
`e2e/`).

## Architecture essentials

**Dependency direction** is strict: `apps/*` → `packages/*`, never the reverse.
Enforced by `pnpm boundaries` (`turbo boundaries`, run in CI): every app is
tagged `app`, every package `package`, and nothing may depend on an `app`.
Within packages, the rough order is `tsconfig` / `env` → `types` → `db` →
`auth`; `ui`, `storage`, and `logger` are leaves. No circular deps.

**Internal packages have no build step** ("Just-in-Time" packages in Turborepo
terms). They're consumed as TypeScript source; Turbopack transpiles workspace
packages automatically, so there is no `transpilePackages` list to maintain.
Edits in `packages/*` show up in apps without rebuilding. The one exception is
`@repo/db`, whose `build` script runs `prisma generate` so every app's `^build`
produces the client (a root `postinstall` also generates it).

**The public web app works without `DATABASE_URL`.** `apps/web/lib/db.ts` falls
back to `@repo/db/seed-data` (the example dataset). This is intentional — a
fresh clone must boot with zero setup. Don't replace the fallback with ad-hoc
mock data; use `@repo/db/seed-data`.

**Example domain model.** One generic resource, `Item` (`title`, `description`,
`status` enum `draft|active|archived`, optional `owner` relation, soft-delete
via `deletedAt`). The admin app has one CRUD resource (`/items`) plus user
management (`/users`) and profile (`/profile`). Better Auth tables
(user/session/account/verification) are kept verbatim — they're the contract
Better Auth's Prisma adapter expects.

**Auth model** — Better Auth 1.7 with the `admin` plugin. Roles are
`admin | editor | viewer`. Public sign-up is disabled (email and Google);
accounts come from the `/users` invite flow (which picks a role) or, for the
first admin, `pnpm auth:create-admin`. `defaultRole` is `viewer`. DB-backed sessions (instant
revoke, no JWT staleness), email/password + optional Google OAuth, Prisma
adapter.

- **RBAC** — a capability map (`Capability`, `ROLE_CAPABILITIES`) lives in
  `packages/auth/src/permissions.ts`, mirrored on the Better Auth side by an
  access-control config in `packages/auth/src/access-control.ts`. Roles are also
  a Zod enum in `@repo/types` (`appRoleSchema` + `ROLE_LABELS` /
  `ROLE_DESCRIPTIONS`). Keep enum + permission map + access-control in lockstep.
- `proxy.ts` (replaces `middleware.ts` post-CVE-2025-29927) is **optimistic,
  cookie-only** in the admin app — never the sole gate. The web app's `proxy.ts`
  does per-IP rate limiting, not auth.
- The gates in `@repo/auth/next`, called in Server Components / route handlers /
  Server Actions, are the source of truth: `requireCapability(capability)` for
  resources (items pages/actions use `items.*`, users use `users.manage`),
  `requireSession()` for surfaces every role sees (the dashboard shell,
  profile), `requireAdmin()` / `requireRole(...)` when a role is really meant.
  All redirect to `/sign-in` (no session) or `/forbidden` (not allowed /
  banned). The session lookup is `cache()`d, so gating in layout + page is
  free. The sidebar hides links the role can't open; the page is still the gate.
- Only the admin app mounts `/api/auth/[...all]`.

**Database** — plain Postgres via Prisma 7 + `@prisma/adapter-pg` (node-postgres).
Works with local Docker, Neon, Supabase, RDS, Railway. For spatial work, the
`feat/geo` branch re-introduces PostGIS + a map; cherry-pick it when needed.
For raw SQL, use `prisma.$queryRaw<Row[]>\`...\``with a typed row generic;
tagged template literals parameterize safely. Don't reach for`any`.

**State** — Server Components for data, **URL search params for filters/sort/
selection** (the `Item` filters are `ItemFilters` in `@repo/types`), `useState`
for local UI only. No Redux / Zustand / React Query. When adding a new filter,
update the relevant schema in `@repo/types` and the query builder in
`packages/db/src/queries/`.

**Env** — each package owns its schema in a `keys.ts` (`@repo/db/keys`,
`@repo/auth/keys`, `@repo/storage/keys`), and each app's `env.ts`
(`apps/<app>/env.ts`) composes the schemas of the packages it uses with
`createEnv({ extends: [...] })` (the next-forge convention). App server code
reads `import { env } from "@/env"`. Cross-app config stays in `@repo/env`:
`@repo/env/client` (the `NEXT_PUBLIC_*` one,
including `APP_ENV`/`NEXT_PUBLIC_APP_ENV` — the deployment marker that drives a
non-production banner; unset = production), `@repo/env/features` (server-only
feature flags, off by default — `getFeatureFlags()` reads them, and
`requireFeature(flag)` from `apps/admin/lib/require-feature.ts` gates a route,
redirecting to `/forbidden` like the other gates), and
`@repo/env/revalidate`. Never `process.env.X` directly in app code (the one
sanctioned exception is `@repo/logger`, which reads `LOG_LEVEL`/`NODE_ENV`
before any env module is loaded). Adding an env var — including a feature
flag — requires updating: the `.env.example` files, `turbo.json`'s `build.env`
array, the Zod schema in the owning package's `keys.ts` (or `packages/env/src/`
for cross-app config), and the app `env.ts` if a new schema must be composed.

**Env files are centralized at the repo root.** Root `.env.local` is shared by
both apps and the Prisma CLI tooling. Each app's `dev` script loads
`apps/<app>/.env.local` FIRST (per-app overrides win on duplicate keys) then
root `.env.local` (shared vars fill in the rest) via `dotenv-cli` — a missing
file is not an error, so a fresh clone with no env files still boots. Per-app
`.env.example` files are slim: only the overrides that must differ per app
(e.g. admin's `BETTER_AUTH_URL`). `.env.staging` / `.env.production` at the
root are gitignored, per-stage files that back the `db:*:staging` / `db:*:prod`
commands.

**Display name** — read from `@repo/env/client`'s `APP_NAME`
(`NEXT_PUBLIC_APP_NAME`, default "Internal Tools"). Never hardcode the product
name in UI.

**Catalog versions** — framework/tooling versions are pinned in
`pnpm-workspace.yaml`'s `catalog:` block. Bump there once; every workspace picks
it up. Don't pin Next/React/Tailwind versions in individual `package.json`
files — reference `"catalog:"`.

## Conventions worth knowing

- **No `any`.** Declare row types for `$queryRaw`; write explicit shapes.
- **No ad-hoc mock data in components** — fall back to `@repo/db/seed-data`.
- **No hard-coded colors/fonts** — use design tokens from `@repo/ui` (Tailwind 4
  `@theme inline`, oklch palette). Status tone tokens are semantic:
  `--status-success`, `--status-warning`, `--status-muted` (each with a `-soft`
  background variant). When generating shadcn components, rewrite literal colors
  to tokens (e.g. `bg-primary`, not `bg-amber-500`) before merging.
- **Shadcn used in both apps** lives in `packages/ui/src/components/` with an
  `exports` entry in `packages/ui/package.json`.
- **Server-side data fetching by default.** Drop to `"use client"` only when
  needed for interactivity.
- **Mutations are Server Actions** (`_actions.ts` colocated with the route),
  guarded by `requireCapability(...)`. They return `ActionResult`
  (`apps/admin/lib/action-result.ts`) instead of throwing — production hides
  thrown messages — write an audit entry with `audit()` (`apps/admin/lib/audit.ts`;
  the `audit_log` table is append-only via a DB trigger), and invalidate cache
  tags via `updateTag(...)` (+ `revalidateWeb(...)` for public data).
- **No barrel files inside packages** — they hurt tree-shaking. Expose subpath
  `exports` instead (`@repo/db/client`, `@repo/db/queries/items`).
- **Avoid abbreviations** in public APIs (`organization`, not `org`).

## Agent skills and subagents

Project skills are committed under `.claude/skills/` and pinned in
`skills-lock.json` (managed with Vercel's `skills` CLI): Better Auth, Turborepo,
Next.js Cache Components adoption, Prisma 7 CLI + Client API, shadcn, Vercel
React best practices, Web Interface Guidelines, impeccable, TDD, diagnose and a
few planning skills. Next.js reference knowledge is not a skill anymore — it
ships as `next/dist/docs/` plus the `AGENTS.md` that `next dev` writes.

`npx skills update -p -y` rewrites skills as symlinks into `.agents/`, which is
gitignored — clones would get broken links. After updating, reinstall each
changed skill as a copy: `npx skills add <source> --skill <name> --agent
claude-code --copy -y` (sources are in `skills-lock.json`).

The only project subagent is `security-auditor` (`.claude/agents/`): run auth,
RBAC, audit-log and PII-sensitive changes past it.

## Commit conventions

`feat: | fix: | refactor: | chore: | docs: | style: | test:`. Enforced by
commitlint on `commit-msg`. Branches `feat/short-description`. Squash on merge.

## Where to look

| Topic                                       | File                              |
| ------------------------------------------- | --------------------------------- |
| Starting a new project from this template   | `docs/00-starter-guide.md`        |
| Architecture & request flows                | `docs/01-architecture.md`         |
| Local setup & troubleshooting               | `docs/02-getting-started.md`      |
| Schema, adapter, migrations, seeding        | `docs/03-database.md`             |
| Better Auth config, role gates, sessions    | `docs/04-authentication.md`       |
| Design tokens, anti-patterns                | `docs/06-design-system.md`        |
| HTTP endpoints + Server Action surface      | `docs/07-api-reference.md`        |
| Hosting, OAuth, env per stage               | `docs/08-deployment.md`           |
| Day-to-day recipes (add table, route, etc.) | `docs/09-development-workflow.md` |
