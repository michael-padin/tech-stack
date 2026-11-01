# Architecture

## High-level layout

This is a **Turborepo monorepo** with two Next.js applications and a set of
shared packages:

```
internal-stack-template/
├── apps/
│   ├── web/      Public app             → http://localhost:3000
│   └── admin/    Admin dashboard        → http://localhost:3001
└── packages/
    ├── ui/         Design tokens + shared shadcn components
    ├── db/         Prisma schema, typed queries, seed + DB-less fallback
    ├── auth/       Better Auth config (server + client + Next.js)
    ├── env/        Typesafe env (@t3-oss/env-core + env-nextjs)
    ├── types/      Zod schemas + shared domain types
    ├── storage/    Optional S3/R2 helpers (presigned uploads)
    ├── logger/     pino structured logger
    └── tsconfig/   Shared TS configs (base / nextjs / react-library)
```

### Why two apps instead of one?

Splitting the public surface from the dashboard upfront buys you:

- Independent deploys (they scale and ship differently)
- Smaller client bundles (the public app doesn't ship admin code)
- A clean role boundary at the URL level (`app.example.com` vs
  `admin.example.com`)

Both apps share data via `@repo/db` and identity via `@repo/auth`, so the
ergonomic cost is low. Cross-app session sharing requires a parent-domain
cookie config in production — see
[Authentication — sharing sessions](./04-authentication.md#sharing-sessions-across-apps).

## Package responsibilities

```
                          ┌──────────────────┐
                          │   @repo/types    │  ← Zod schemas (single source)
                          └────┬─────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼               ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │  @repo/db    │ │ @repo/storage│ │  @repo/auth  │
        │ Prisma+query │ │  S3/R2 (opt) │ │  Better Auth │
        └──────┬───────┘ └──────────────┘ └──────┬───────┘
               │                                 │
               ▼                                 │
        ┌──────────────────┐                     │
        │ @repo/db/seed-data│ ◄──────────────────┘
        │ example dataset   │
        └────────┬──────────┘
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  apps/web    │    │  apps/admin  │
│   (3000)     │    │   (3001)     │
└──────┬───────┘    └──────┬───────┘
       │                   │
       └─────────┬─────────┘
                 ▼
         ┌──────────────┐
         │  @repo/ui    │  ← Tokens + shared components
         └──────────────┘
```

### Dependency rules

- **Apps depend on packages**, never the other way around.
- **Packages may only depend on packages they're "below"** in the diagram.
  `@repo/types` depends on nothing else; `@repo/db` depends on `@repo/types`;
  `@repo/auth` depends on `@repo/db` and `@repo/types`. `@repo/ui`,
  `@repo/storage`, and `@repo/logger` are leaves.
- **No circular dependencies.**

## Request lifecycle (public app)

A typical "list items" interaction:

```
User → apps/web (Next.js Server Component, app/page.tsx)
       │
       ├─ fetchItems() in lib/db.ts
       │     │
       │     ├─ if DATABASE_URL: cached listItems() via @repo/db
       │     │     ↓
       │     │   Postgres (via @prisma/adapter-pg)
       │     │     ↓
       │     │   Rows projected to Item[]
       │     │
       │     └─ else: example dataset from @repo/db/seed-data,
       │           filtered/sorted in memory
       │
       └─ rendered list; selecting a row navigates to /items/[id]
            └─ filters / sort / search live in URL search params
```

Key design choice: **the public app works without a database**. When
`DATABASE_URL` is unset, `lib/db.ts` falls back to the example dataset
(`@repo/db/seed-data`). A fresh clone boots with zero setup.

## Request lifecycle (admin dashboard)

```
User → apps/admin (any path, e.g. /items)
       │
       ├─ proxy.ts checks for a session cookie (optimistic only)
       │     │
       │     └─ no cookie → 302 /sign-in?redirect=/items
       │
       ├─ Server Component runs requireAdmin()  (from @repo/auth/next)
       │     │
       │     ├─ no session  → 302 /sign-in
       │     ├─ not admin   → 302 /forbidden
       │     ├─ banned      → 302 /forbidden
       │     └─ ok          → continue
       │
       └─ data read via @repo/db, rendered inside AdminShell
```

The proxy is a fast deny path; the Server Component is the source of truth.

## Mutations (Server Actions + cache revalidation)

Writes are **Server Actions** colocated with their route (`_actions.ts`), not
HTTP endpoints. Each action calls `requireAdmin()`, validates input with a Zod
schema from `@repo/types`, writes via `@repo/db`, then invalidates the relevant
cache tag (`updateTag(...)`).

When the admin mutates data the public app caches, it POSTs to the web app's
`/api/revalidate` route (bearer-authenticated with `REVALIDATE_SECRET`) so the
public cache tags refresh. See
[API reference](./07-api-reference.md#post-apirevalidate-web).

## Authentication topology

Only the **admin** app mounts `/api/auth/[...all]` from `@repo/auth/next`.
Better Auth stores:

- **`user`** — name, email, role (`admin` — single role), ban fields
- **`session`** — DB-backed sessions (revocable instantly, no JWT staleness)
- **`account`** — OAuth provider links (Google, etc.)
- **`verification`** — email/password reset tokens

Session cookies are HttpOnly, SameSite=Lax. In production, set `BETTER_AUTH_URL`
to the canonical app URL and configure cross-subdomain cookies if you want SSO
across both apps.

## State management

- **Server state** — Next.js Server Components fetch and pass data down.
- **URL state** — filters, sort, and selection live in URL search params (the
  `Item` filters are `ItemFilters` in `@repo/types`). Sharable links survive
  reload.
- **Local state** — `useState` for UI bits only (dialog open/closed, form drafts).

There is **no** Redux, Zustand, or React Query. Server Components plus URL state
cover the data flow.

## Build pipeline

`pnpm build` runs `turbo run build`, which:

1. Topologically sorts packages
2. Runs `@repo/db`'s `generate` (Prisma client) before app builds
3. Builds `@repo/web` and `@repo/admin`

Internal packages **don't have a `build` step** — they're consumed as
TypeScript source, which Turbopack transpiles automatically for workspace
packages. Edits in `packages/*` show up in apps without a rebuild. `@repo/db` is
the exception: its `build` script runs `prisma generate`.

## Why these technologies?

- **Better Auth over a hosted auth vendor** — no per-MAU cost, full data
  ownership, instant session revocation (sessions are rows in Postgres).
- **Prisma 7 + `@prisma/adapter-pg`** — the node-postgres driver works with any
  standard Postgres (local Docker, Neon, Supabase, RDS, Railway). The typed CRUD
  surface covers most needs; drop to `$queryRaw<Row[]>` for anything bespoke.
- **Postgres** — a boring, ubiquitous default. Spatial features (PostGIS, maps)
  live on the `feat/geo` branch to cherry-pick when needed.
- **oxlint + oxfmt** — fast Rust-based lint/format with one toolchain.
- **Turborepo** — simple config, good Next.js ergonomics, cached task graph.
- **Tailwind 4** — token-based design system fits cleanly in `@theme inline`.
- **Vitest + Playwright** — unit tests next to package source; e2e in `e2e/`.
