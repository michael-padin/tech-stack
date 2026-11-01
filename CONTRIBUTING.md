# Contributing

The bar for contributions is "would a future reader of this codebase appreciate
the change being there?"

## Before you start

Read these docs (in order):

1. [Architecture](./docs/01-architecture.md) — package boundaries
2. [Getting started](./docs/02-getting-started.md) — local setup
3. The relevant per-area doc:
   - Schema work? → [Database](./docs/03-database.md)
   - Auth work? → [Authentication](./docs/04-authentication.md)
   - UI work? → [Design system](./docs/06-design-system.md)

## Setup

```bash
git clone <repo>
cd internal-stack-template
pnpm install
cp .env.example .env            # or per-app: apps/web/.env.local, apps/admin/.env.local
# Fill in DATABASE_URL, BETTER_AUTH_SECRET, etc.
pnpm db:up                      # local Postgres via Docker
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Branch + commit conventions

```
feat:     new feature
fix:      bug fix
refactor: behavior-preserving rewrite
chore:    config, deps, tooling
docs:     documentation only
style:    formatting only
test:     test changes only
```

Branch: `feat/short-description`, `fix/issue-summary`. Squash on merge. The
`commit-msg` git hook (lefthook + commitlint) enforces this format; the
`pre-commit` hook runs oxlint + oxfmt on staged files.

## Pull request checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` and `pnpm format` pass
- [ ] `pnpm test` passes (add/adjust tests for behavior changes)
- [ ] If you changed the schema, you regenerated the migration
      (`pnpm db:migrate:dev`) and committed the SQL
- [ ] If you added a new env var, you updated `.env.example`, the Zod schema
      in the owning package's `keys.ts` (or `packages/env/src/`), and `turbo.json`'s `env` array
- [ ] If you added a public API endpoint, you documented it in
      [`docs/07-api-reference.md`](./docs/07-api-reference.md)
- [ ] If you added a new admin-protected route, the actual `requireAdmin()`
      call is in the Server Component / route handler (not just the proxy)
- [ ] You verified the change works end-to-end (not just "the type checker is
      happy")

## Things we don't accept

- **New top-level dependencies** in `apps/*` without justification — most
  shared things should live in a `packages/*` package
- **Mock data in components** — fall back to `@repo/db/seed-data` instead
- **Hard-coded colors or fonts** — use the design tokens from `@repo/ui`
- **`any` types** — write the explicit shape

## Opening an issue

When reporting a bug, include:

- Which app (`@repo/web` or `@repo/admin`)
- Steps to reproduce
- Expected vs actual behavior
- Browser + Node + pnpm versions (`node -v`, `pnpm -v`)

When proposing a feature, include the user story (who wants this and why) and a
rough sketch of the implementation.
