# Starter guide — starting a new project from this template

This template is a generic, brand-neutral starting point. Everything is wired
to the `@repo/*` scope and the display name "Internal Tools" so a fresh clone is
self-describing. This guide takes you from a fresh clone to a renamed,
running project of your own.

If you just want to run the template as-is, see
[Getting started](./02-getting-started.md) instead.

## 1. Create your repo from the template

On GitHub, click **"Use this template" → "Create a new repository"** (or fork
it). Then clone your new repo:

```bash
git clone <your-new-repo> my-app
cd my-app
pnpm install
```

`pnpm install` links the internal `@repo/*` packages via workspaces — there's no
build step for them.

## 2. Rename the scope, slug, and display name

There are three things to make yours:

| Thing          | From                      | To (example) | Where                                          |
| -------------- | ------------------------- | ------------ | ---------------------------------------------- |
| Package scope  | `@repo`                   | `@acme`      | every `package.json`, every import, configs    |
| Workspace name | `internal-stack-template` | `acme-tools` | root `package.json` `name`                     |
| Display name   | "Internal Tools"          | "Acme Tools" | `NEXT_PUBLIC_APP_NAME` in both apps' env files |

### Renaming the scope (`@repo` → `@yourscope`)

The scope appears in package names, internal imports, `exports` maps, and a few config files. Do a workspace-wide
find-and-replace of the literal string `@repo` with your scope, then reinstall:

```bash
# Replace @repo with @acme across the workspace (excludes node_modules / .git).
grep -rl --exclude-dir=node_modules --exclude-dir=.git '@repo' . \
  | xargs sed -i 's/@repo/@acme/g'

pnpm install
```

After the swap, verify the workspace still resolves:

```bash
pnpm typecheck
```

> A `scripts/rename-template.ts` helper (run via `pnpm rename`) is the intended
> way to do this end to end — scope, root `name`, and `NEXT_PUBLIC_APP_NAME` in
> one pass, with a confirmation prompt. If your clone doesn't include it yet,
> the manual `grep | sed` above does the same job; just also update the display
> name and root package name in the next steps.

### Setting the display name

The product name is **never hardcoded** — both apps read it from
`NEXT_PUBLIC_APP_NAME` (via `@repo/env/client`'s `APP_NAME` constant, default
`"Internal Tools"`). Set it in each app's env file:

```dotenv
# apps/web/.env.local and apps/admin/.env.local
NEXT_PUBLIC_APP_NAME=Acme Tools
```

### Updating the root metadata

Edit the root `package.json` `name` and `description`, and the `CODEOWNERS` /
issue templates under `.github/` if you keep them.

## 3. Configure environment

Each context loads its own env file. Copy the examples:

```bash
cp apps/web/.env.example     apps/web/.env.local
cp apps/admin/.env.example   apps/admin/.env.local
cp packages/db/.env.example  packages/db/.env.local
```

Then fill them in. The must-haves:

- **`BETTER_AUTH_SECRET`** — generate once and paste the **same value** into
  both app env files:

  ```bash
  openssl rand -base64 32
  ```

- **`DATABASE_URL`** — required for admin and any DB read. The web app can run
  without it (it falls back to the seed dataset).

The full variable reference is the root [`.env.example`](../.env.example).
Every variable is validated at boot by `@repo/env/*` — see
[Getting started](./02-getting-started.md#3-configure-environment).

## 4. First migration and seed

Start local Postgres (Docker), apply the migration, and load the example data:

```bash
docker compose up -d db   # postgres:16, matches the default DATABASE_URL
pnpm db:migrate           # prisma migrate deploy — applies the init migration
pnpm db:seed              # idempotent — re-runnable
```

`pnpm db:seed` upserts the example `Item` rows (see
[Database — seeding](./03-database.md#seeding)). It's safe to re-run.

When you replace the `Item` model with your own:

1. Edit `packages/db/prisma/schema.prisma`.
2. Author a migration: `pnpm db:migrate:dev`.
3. Refresh the client: `pnpm db:generate`.
4. Update the seed and the typed queries (`packages/db/src/queries/`,
   `packages/db/src/seed/`), and the Zod schemas in `@repo/types`.

## 5. Run it

```bash
pnpm dev
```

- Public app — http://localhost:3000
- Admin dashboard — http://localhost:3001

Create your first admin by signing up at http://localhost:3001/sign-in — new
sign-ups default to the `admin` role.

## 6. Pulling in maps / PostGIS (`feat/geo`)

The base template is **non-spatial** (plain Postgres, no map). Spatial
features — the `postgis` extension, `Unsupported(...)` geometry columns, the
`ST_*` raw-query conventions, a geodetic `coordinates` package, and a Mapbox
map — live on a separate **`feat/geo`** branch so you only carry them when a
project needs them.

To bring them into your project:

```bash
git fetch origin feat/geo

# Option A — cherry-pick the geo commits onto your branch:
git log origin/feat/geo --oneline      # find the commits you want
git cherry-pick <commit>...            # apply them

# Option B — merge the branch wholesale:
git merge origin/feat/geo
```

After pulling it in, expect to:

- Swap the `docker-compose.yml` image from `postgres:16` to
  `postgis/postgis:16-3.4` (it's commented in the file).
- Re-run `pnpm db:migrate` so the PostGIS extension and geometry columns are
  created.
- Add the map-related `NEXT_PUBLIC_*` env vars the geo branch introduces (its
  `.env.example` files document them).

Resolve any conflicts in `schema.prisma`, the seed, and the env modules — the
geo branch extends the same files the base template ships.

## 7. Trim what you don't need

The template is deliberately full-featured. Remove what doesn't apply:

- **No file uploads?** Drop `@repo/storage` from the apps' dependencies, and delete the `R2_*` / `NEXT_PUBLIC_R2_PUBLIC_URL` env
  vars from the examples and the `@repo/env/storage` schema.
- **No error tracking?** Leave `NEXT_PUBLIC_SENTRY_DSN` unset — the
  instrumentation files no-op. Remove `@sentry/nextjs` only if you want a
  smaller install.
- **Don't need the public app?** Keep just `apps/admin` and delete `apps/web`
  (and its revalidation wiring).

## Next steps

- [Architecture](./01-architecture.md) — the big picture
- [Database](./03-database.md) — before you change the schema
- [Authentication](./04-authentication.md) — before you add protected routes
- [Development workflow](./09-development-workflow.md) — day-to-day recipes
