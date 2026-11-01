# API reference

The template is **Server-Component- and Server-Action-first**: most data flow
goes through React Server Components (reads) and Server Actions (writes), not
HTTP endpoints. The only HTTP routes are the cache-revalidation hook and the
Better Auth handler.

Request/response shapes for the domain are defined as Zod schemas in
`packages/types/src/index.ts`.

## HTTP endpoints

### `POST /api/revalidate` (web)

`apps/web/app/api/revalidate/route.ts`. Lets the admin app invalidate the public
app's Next.js cache tags after a mutation. Bearer-authenticated with the shared
`REVALIDATE_SECRET`.

**Auth:** `Authorization: Bearer <REVALIDATE_SECRET>`. Returns `401` on
mismatch, `500` if the secret isn't configured on the server.

**Request body**

```json
{ "tags": ["public-items", "item:<id>"] }
```

- `public-items` — the list tag (invalidates the items list).
- `item:<id>` — a per-detail tag (invalidates one item's detail page). Must
  match `^item:[\w-]+$`.

At least one tag is required. Unknown tags that don't match a known constant or
the `item:<id>` pattern are rejected with `400`.

**Response 200**

```json
{ "revalidated": true, "tags": ["public-items"] }
```

**Response 400 / 401 / 500**

```json
{ "error": "Invalid body. Expected { tags: string[] }", "knownTags": ["public-items"] }
{ "error": "Unauthorized" }
{ "error": "Revalidation is not configured" }
```

The admin side calls this from `apps/admin/lib/revalidate-web.ts` after a
mutation (fire-and-forget via `after()`), only when both `NEXT_PUBLIC_WEB_URL`
and `REVALIDATE_SECRET` are set.

### `/api/auth/[...all]` (admin)

`apps/admin/app/api/auth/[...all]/route.ts` mounts the full Better Auth surface.
See https://better-auth.com/docs for the complete list; the most-used routes:

| Method | Path                           | Purpose                              |
| ------ | ------------------------------ | ------------------------------------ |
| POST   | `/api/auth/sign-up/email`      | Create account with email + password |
| POST   | `/api/auth/sign-in/email`      | Sign in with email + password        |
| POST   | `/api/auth/sign-in/social`     | Initiate OAuth flow (Google)         |
| GET    | `/api/auth/callback/:provider` | OAuth callback URL                   |
| POST   | `/api/auth/sign-out`           | Revoke current session               |
| GET    | `/api/auth/get-session`        | Read the current session             |
| POST   | `/api/auth/admin/list-users`   | (admin) list users                   |
| POST   | `/api/auth/admin/ban-user`     | (admin) ban a user                   |
| POST   | `/api/auth/admin/remove-user`  | (admin) delete a user                |

In app code, use the typed clients rather than fetching these directly:

```tsx
// Client component
import { signIn, signOut, authClient } from "@repo/auth/client";

// Server component / route handler / action
import { requireAdmin } from "@repo/auth/next";
```

## Server Actions (the write surface)

Mutations are Server Actions, colocated with their route under
`apps/admin/app/(dashboard)/`. Each guards with `requireCapability(...)`,
validates with a Zod schema from `@repo/types`, writes via `@repo/db`, records an
audit entry, invalidates the relevant cache tag, and returns an `ActionResult`
(`{ ok: true, data } | { ok: false, error }`) rather than throwing.

### Items — `items/_actions.ts`

| Action             | Signature                        | Notes                                                                      |
| ------------------ | -------------------------------- | -------------------------------------------------------------------------- |
| `createItemAction` | `(input: ItemInput)`             | `items.create`; sets owner to the current user; redirects to `/items/<id>` |
| `updateItemAction` | `(id: string, input: ItemInput)` | `items.update`; audits before/after                                        |
| `deleteItemAction` | `(id: string)`                   | `items.delete`; soft delete (`deletedAt`); no redirect                     |

All three invalidate `CACHE_TAGS.items` via `updateTag(...)` and call
`revalidateWeb(["public-items", "item:<id>"])` so the public site refreshes.

`ItemInput` (`itemInputSchema`):

- `title` — 2–200 chars, required
- `description` — ≤ 2000 chars, optional / nullable
- `status` — `draft | active | archived` (defaults to `draft`)

### Users — `users/_actions.ts`

`inviteUserAction`, `banUserAction`, `unbanUserAction`, `removeUserAction`,
`resetUserPasswordAction` — thin wrappers over Better Auth's admin API. See
[Authentication — user management](./04-authentication.md#user-management-server-actions).

### Profile — `profile/_actions.ts`

`revokeMySessionAction(token)` — revoke one of the current user's own device
sessions.

## Reads (Server Components + the query layer)

Public and admin pages read through the typed helpers in
`packages/db/src/queries/` (imported as `@repo/db/queries/<file>`):

- `listItems(filters)` / `getItemById(id)` — public reads (soft-deleted excluded)
- `listItemsPaginated(filters, page)` — admin list (returns `Paginated<Item>`)
- `getAdminSummary()` — dashboard per-status counts

The public app wraps these in `apps/web/lib/db.ts`, which adds Next.js caching
(`"use cache"` + `cacheTag`) and the DB-less fallback to `@repo/db/seed-data`.

## Conventions when you add an HTTP endpoint

If you do need a real HTTP route (a webhook, an integration callback, a public
JSON API), follow the existing patterns:

- Validate input with a Zod schema; return `{ error, issues? }` on failure.
- Gate protected routes with `requireCapability(...)` (it redirects on failure).
- Type any `$queryRaw` result with a row generic — never `any`.
- Document the new endpoint here.

```ts
// apps/web/app/api/example/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({ status: z.enum(["draft", "active", "archived"]).optional() });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  // ... read via @repo/db
  return NextResponse.json({ data: [] });
}
```
