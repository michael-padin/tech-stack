# Development workflow

How to do common tasks in the monorepo. All commands run from the **repo root**
unless noted.

## Day-to-day commands

### Running

```bash
pnpm dev              # both apps in parallel (Turborepo TUI)
pnpm dev:web          # public app only
pnpm dev:admin        # admin dashboard only
```

### Building

```bash
pnpm build            # build everything (used in CI)
pnpm turbo run build --filter=@repo/web   # just one app + its deps
```

### Quality gates

```bash
pnpm lint             # oxlint across the workspace (NOT eslint)
pnpm format           # oxfmt (NOT prettier); pnpm format:fix to write
pnpm typecheck        # tsc --noEmit across the workspace
pnpm test             # Vitest unit tests
```

Unit tests live next to the code they cover under `packages/*/src/**/*.test.ts`
(see `vitest.config.ts` / `vitest.workspace.ts`). End-to-end tests live in
`e2e/` and run on Playwright (`playwright.config.ts`).

### Database

```bash
pnpm db:generate      # prisma generate (refresh client types)
pnpm db:migrate       # prisma migrate deploy (apply pending)
pnpm db:migrate:dev   # prisma migrate dev (author + apply a new migration)
pnpm db:seed          # idempotent seed of example data
pnpm db:studio        # open Prisma Studio
pnpm db:push          # bypass migrations, push schema directly (DEV ONLY)
```

### Auth

```bash
pnpm auth:gen-schema  # regenerate auth schema after plugin changes
```

## Git hooks

`lefthook` runs on commit. **Pre-commit** lints + formats staged source files
(oxlint `--fix`, oxfmt) and re-stages the fixes. **commit-msg** validates the
message against Conventional Commits via commitlint. Hooks install on
`pnpm install`.

## Adding a new package

```bash
mkdir -p packages/new-pkg/src
```

`packages/new-pkg/package.json`:

```json
{
  "name": "@repo/new-pkg",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": {
    "@repo/tsconfig": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

`packages/new-pkg/tsconfig.json`:

```json
{ "extends": "@repo/tsconfig/base.json", "include": ["src/**/*.ts"] }
```

Then in the consuming app's `package.json` add `"@repo/new-pkg": "workspace:*"`
and run `pnpm install`. No `next.config.ts` change is needed — Turbopack
transpiles workspace packages automatically.

## Adding a new shadcn component

```bash
cd apps/web                       # or apps/admin
pnpm dlx shadcn@latest add dialog
```

Rewrite literal colors to design tokens (`bg-primary`, not `bg-amber-500`)
before merging. If a component is used in **both** apps, move it to
`packages/ui/src/components/dialog.tsx` and add it to the `exports` map in
`packages/ui/package.json`.

## Adding a new env var

1. Add it to the relevant `.env.example` files (root + the app(s) that need it),
   with a comment.
2. Add it to `turbo.json`'s `build.env` array so Turborepo invalidates cache on
   change.
3. Declare it in the schema of the package that owns it: `packages/db/src/keys.ts`,
   `packages/auth/src/keys.ts`, `packages/storage/src/keys.ts`, or — for
   cross-app config — `packages/env/src/client.ts` (for `NEXT_PUBLIC_*`, also
   add it to that module's `runtimeEnv` map), `features.ts` or `revalidate.ts`.
   The Zod schema there is the source of truth. A new package with env gets
   its own `keys.ts` and an entry in the `extends` list of each app's `env.ts`.
4. Read it in app server code via `import { env } from "@/env"`; inside a
   package, via `const env = keys()`. Never `process.env.X` directly.

## Adding a new database table

1. Add a model to `packages/db/prisma/schema.prisma`:

   ```prisma
   model widget {
     id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     name      String
     createdAt DateTime @default(now()) @map("created_at") @db.Timestamp(6)
     @@map("widgets")
   }
   ```

2. Author + apply the migration in dev, then refresh the client:

   ```bash
   pnpm db:migrate:dev
   pnpm db:generate
   ```

3. Add typed query helpers in `packages/db/src/queries/` (export them from
   `queries/index.ts`).

4. Add matching Zod schemas/types to `@repo/types` if the shape crosses the
   server/client boundary.

5. Use from either app via `import { listWidgets } from "@repo/db"` (or
   `import { prisma } from "@repo/db"` for raw access).

## Adding a new admin resource (CRUD)

Mirror the `Item` example end to end:

1. **Model** in `schema.prisma` + migration (above).
2. **Queries** in `packages/db/src/queries/`.
3. **Types** in `@repo/types` (`*InputSchema`, `*FilterSchema`).
4. **Route** under `apps/admin/app/(dashboard)/<resource>/page.tsx`, calling
   `requireAdmin()`.
5. **Server Actions** in `<resource>/_actions.ts` — guard with `requireAdmin()`,
   validate with the Zod schema, mutate via `@repo/db`, then `updateTag(...)`.
6. **Nav** — append an entry to the `NAV` array in
   `apps/admin/components/sidebar-nav.tsx`.

## Adding a public page

```tsx
// apps/web/app/<route>/page.tsx
import { fetchItems } from "@/lib/db";

export default async function Page() {
  const items = await fetchItems({ status: "active" });
  return <List items={items} />;
}
```

`fetchItems` / `fetchItemById` in `apps/web/lib/db.ts` add caching and the
DB-less fallback. Filters/sort/selection belong in URL search params, not local
state.

## Cross-app cache revalidation

When an admin mutation changes data the public app caches, call
`revalidateWeb([...])` (`apps/admin/lib/revalidate-web.ts`). It POSTs the tags to
the web app's `/api/revalidate` route after the response (`after()`), only when
`NEXT_PUBLIC_WEB_URL` and `REVALIDATE_SECRET` are both set. The known web tags
live in `apps/web/lib/db.ts` (`PUBLIC_ITEMS_TAG` and the per-item tag).

## Debugging

### "Why isn't this re-rendering?"

Check whether you're in a Server Component (no `"use client"` at the top).
Server Components only re-fetch on URL change or an explicit `router.refresh()`.

### "Why is the dev server noisy?"

```bash
pnpm turbo run dev --ui=stream
```

If a single package rebuilds repeatedly, check for a circular dependency.

### "Prisma is generating broken SQL"

Turn on query logging by adding `"query"` to the `log` array on the
`PrismaClient` in `packages/db/src/client.ts` while debugging. For anything the
typed builder can't express, drop to `prisma.$queryRaw<Row[]>` with a tagged
template literal — it parameterizes values safely. Never reach for `any`.

## Code style

- **Avoid abbreviations** in public APIs (`organization`, not `org`).
- **Server-side data fetching by default** — use Server Components; drop to
  client only for interactivity.
- **No `any`** — type `$queryRaw` rows with the generic parameter.
- **No barrel files inside packages** — re-exports are fine, but big
  re-export `index.ts` files hurt tree-shaking.
- **No hard-coded colors/fonts** — use `@repo/ui` tokens.

## Git conventions

```
feat:     new feature
fix:      bug fix
refactor: behavior-preserving rewrite
chore:    config, dependency bumps
docs:     documentation only
style:    formatting only
test:     test changes only
```

Branch names: `feat/short-description`, `fix/issue-summary`. Squash on merge to
keep the master branch linear. commitlint enforces the format on `commit-msg`.

## Helpful pnpm tricks

```bash
pnpm --filter @repo/db studio          # run a script in one workspace
pnpm -r typecheck                       # run in all workspaces
pnpm --filter @repo/web add some-package
pnpm --filter @repo/web add @repo/logger --workspace   # internal dep
```
