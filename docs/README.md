# Internal-Tools Starter — Documentation

> A Turborepo + Next.js 16 starter for internal tools and small dashboards: a
> public app and an admin dashboard on a set of shared packages.

## What is this?

An opinionated monorepo template you copy to start a new internal-tools project.
It ships:

- **Two apps** — a public read surface (`@repo/web`) and an admin dashboard
  (`@repo/admin`) — sharing data via `@repo/db` and identity via `@repo/auth`.
- **A generic example domain** — an `Item` resource (status, owner, soft-delete)
  that demonstrates the full CRUD path so you can swap in your own model.
- **Batteries included** — typed env, Better Auth (admin / editor / viewer), Prisma +
  Postgres, a shadcn design system on tokens, Vitest + Playwright, lint/format/
  commit hooks, structured logging, and optional Sentry + object storage.

The display name is set per project via `NEXT_PUBLIC_APP_NAME` (default
"Internal Tools"). Maps / PostGIS live on a separate `feat/geo` branch.

## Documentation index

| #   | Document                                             | Purpose                                                                     |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| 00  | [Starter guide](./00-starter-guide.md)               | Starting a new project: rename, env, first migration, pulling in `feat/geo` |
| 01  | [Architecture](./01-architecture.md)                 | The big picture — monorepo layout, package boundaries, request flow         |
| 02  | [Getting started](./02-getting-started.md)           | First-time setup: install, env, DB bootstrap, running both apps             |
| 03  | [Database](./03-database.md)                         | Prisma schema, adapter, migrations, seeding, typed queries                  |
| 04  | [Authentication](./04-authentication.md)             | Better Auth config, roles, protecting routes, sessions                      |
| 06  | [Design system](./06-design-system.md)               | Tokens, typography, status tones, anti-patterns                             |
| 07  | [API reference](./07-api-reference.md)               | HTTP endpoints + the Server Action surface                                  |
| 08  | [Deployment](./08-deployment.md)                     | Env per environment, build pipeline, hosting recommendations                |
| 09  | [Development workflow](./09-development-workflow.md) | Day-to-day: tests, migrations, adding tables/routes/components              |

## Quick links

- **Starting a new project?** → [Starter guide](./00-starter-guide.md)
- **Want to run it locally?** → [Getting started](./02-getting-started.md)
- **Changing the schema?** → [Database — migrations](./03-database.md#migrations)
- **Adding a new admin-protected route?** → [Authentication — protecting routes](./04-authentication.md#protecting-routes)
- **Building a new shadcn component?** → [Design system — adding components](./06-design-system.md#adding-shadcn-components)
- **Want to deploy?** → [Deployment](./08-deployment.md)

## Conventions

Design decisions favor clarity over cleverness. A few load-bearing rules:

- No `any` — write explicit shapes; type `$queryRaw` rows with a generic.
- No hard-coded colors or fonts — use the `@repo/ui` design tokens.
- No ad-hoc mock data in components — fall back to `@repo/db/seed-data`.
- Env is read through `@repo/env/*`, never `process.env.X` directly.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full checklist.
