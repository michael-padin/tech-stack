# Authentication

The template uses **Better Auth 1.7** with the Prisma adapter and the `admin`
plugin. This document covers the config, roles, protecting routes, and sharing
sessions across the two apps.

## Why Better Auth?

- **Database sessions** — sessions are rows in Postgres, not stateless JWTs.
  Revoking a session is a `DELETE` — instant, no stale-token window.
- **No vendor cost** — it costs whatever your Postgres costs; no per-MAU pricing.
- **Code-first** — the entire config is in `packages/auth/src/server.ts`. No
  dashboard, no dev/prod drift.

## Configuration

### `packages/auth/src/server.ts`

```ts
import { prisma } from "@repo/db/client";
import { APP_NAME } from "@repo/env/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  appName: APP_NAME, // from NEXT_PUBLIC_APP_NAME
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // accounts come from invites or `pnpm auth:create-admin`
    requireEmailVerification: false, // no email provider wired by default
    minPasswordLength: 8,
  },

  // Google is enabled only when both client id + secret are present.
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined,

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh on activity
    // cookieCache is intentionally OFF — see the note below.
  },

  rateLimit: { enabled: true, window: 60, max: 30 }, // brute-force protection
  advanced: { database: { joins: true } }, // fuse session+user reads

  plugins: [
    admin({
      defaultRole: "viewer",
      ac: accessControl, // from ./access-control — teaches the plugin our roles
      roles: accessControlRoles, // { admin, editor, viewer }
      adminRoles: ["admin"], // only `admin` gets the admin API
    }),
    nextCookies(), // must be LAST
  ],
});
```

> **`cookieCache` is disabled.** With it on, user fields (`role`, `banned`, …)
> snapshot into the cookie and stay stale for the cache TTL, so an admin banning
> a user would lag from that user's point of view. It's left off until admin
> mutations explicitly invalidate the cookie cache.

Env values come from `@repo/auth/keys` (`const env = keys()` in `server.ts`)
and `@repo/env/client` (the `APP_NAME` display constant). Don't read `process.env.*` directly.

### Required env vars

| Variable                                    | Where                     | Purpose                                                   |
| ------------------------------------------- | ------------------------- | --------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                        | both apps                 | Cookie signing key. **Must match across apps.** 32+ chars |
| `BETTER_AUTH_URL`                           | admin (+ web if it gates) | Canonical URL of _this_ app — used for OAuth callbacks    |
| `DATABASE_URL`                              | both                      | Where sessions are stored                                 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional                  | Enables Google sign-in when both are set                  |

## Roles and permissions

There are three roles: **`admin`**, **`editor`**, and **`viewer`** (the
`app_role` Postgres enum, mirrored as `appRoleSchema` in `@repo/types`).

| Role     | Capabilities                                    |
| -------- | ----------------------------------------------- |
| `admin`  | Full access — items, users, settings, audit log |
| `editor` | Read + create/update/delete items               |
| `viewer` | Read-only (items)                               |

`defaultRole` is `viewer` and public sign-up is disabled (`disableSignUp` for
email, `disableImplicitSignUp` for Google), so nobody can register their way in.
See [Bootstrapping the first admin](#bootstrapping-the-first-admin).

### The permission model

Two layers, kept in lockstep:

- **App-facing capabilities** — `packages/auth/src/permissions.ts` defines a
  `Capability` union (`items.read`, `items.update`, `users.manage`, `audit.read`,
  …) and a `ROLE_CAPABILITIES` map. Route/action guards check a _capability_, not
  a role name, so adding a role later is a data change here, not a sweep through
  call sites. Helpers: `hasPermission(user, capability)`, `hasRole(user,
  ...roles)`, `hasAtLeastRole(user, minimumRole)` (rank-based).
- **Better Auth access control** — `packages/auth/src/access-control.ts` mirrors
  the roles into Better Auth's own access-control system (`createAccessControl`),
  so the admin plugin API and `auth.api.userHasPermission(...)` understand them.
  Wired into the plugin via `ac` + `roles`.

Presentation labels live in `@repo/types` (`ROLE_LABELS`, `ROLE_DESCRIPTIONS`),
the single source of truth for role UI copy.

### Bootstrapping the first admin

Public sign-up is disabled, so create the first admin from the CLI (it prints
a temporary password; re-running it on an existing email promotes that account):

```bash
pnpm auth:create-admin you@example.com "Your Name"
```

It reads `DATABASE_URL` and `BETTER_AUTH_*` from the root `.env.local`; export
the staging/production values in your shell to bootstrap a deployed database.

After that, admins invite others through the `/users` page and pick each
account's role (with a temporary password the inviter shares manually; no email
provider is wired by default).

## Protecting routes

`requireAdmin()` from `@repo/auth/next` is the source of truth. It reads the
session, then redirects to `/sign-in` (no session) or `/forbidden` (not an
admin, or banned and the ban hasn't expired).

For the non-admin roles, two sibling gates with the same redirect conventions:

- **`requireRole(...roles)`** — admits the session only if its role is one of
  the listed ones, e.g. `await requireRole("admin", "editor")`.
- **`requireCapability(capability)`** — resolves the role to its capability set
  and checks one capability, e.g. `await requireCapability("items.update")`.
  Prefer this for resource guards so role membership stays an implementation
  detail.

Both redirect to `/sign-in` when unauthenticated and `/forbidden` when the role
or capability isn't granted (or the user is banned), exactly like
`requireAdmin()`.

### Server Components

```tsx
import { requireAdmin } from "@repo/auth/next";

export default async function ItemsPage() {
  const session = await requireAdmin();
  // ↑ redirects to /sign-in if no session, /forbidden if not an admin
  return <ItemsTable ownerId={session.user.id} />;
}
```

### Server Actions

```ts
"use server";
import { requireAdmin } from "@repo/auth/next";

export async function deleteItemAction(id: string) {
  await requireAdmin();
  // ... mutate via @repo/db, then invalidate the cache tag
}
```

### Route handlers (API)

```ts
import { requireAdmin } from "@repo/auth/next";

export async function GET() {
  await requireAdmin();
  // ...
}
```

`requireAdmin()` calls `redirect()` from `next/navigation` on failure, which
throws `NEXT_REDIRECT` — Next.js catches it and emits the redirect response.

### Client components

Use Better Auth's React client, re-exported from `@repo/auth/client`:

```tsx
"use client";
import { signIn, signOut, authClient } from "@repo/auth/client";

export function NavUser() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return null;
  if (!session) return <a href="/sign-in">Sign in</a>;
  return <button onClick={() => signOut()}>Sign out {session.user.name}</button>;
}
```

## Proxy (middleware) layer

`proxy.ts` in the **admin** app does an **optimistic** session-cookie check.
It's fast (no DB round-trip) but **not** a security boundary on its own — the
real check is `requireAdmin()` in the Server Component or action. It gates
everything except `/sign-in`, `/forbidden`, and `/api/auth/*`:

```ts
// apps/admin/proxy.ts (excerpt)
const PUBLIC_PATHS = new Set(["/sign-in", "/forbidden"]);

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (PUBLIC_PATHS.has(path) || path.startsWith("/_next") || path.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    if (path.startsWith("/api/"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
```

The **web** app's `proxy.ts` does **not** gate auth — it applies a per-IP rate
limit to public POST endpoints. The web app is an anonymous read surface.

> **Why `proxy.ts` and not `middleware.ts`?** Next.js 16 renamed
> `middleware.ts` to `proxy.ts` after CVE-2025-29927 (a header-trust
> vulnerability). Same API, different file name.

## Sharing sessions across apps

The two apps are on different origins (3000 / 3001) in development.

### Local development

Only the admin app mounts the Better Auth handler at `/api/auth/[...all]` and is
where users sign in. Sessions live in the shared database. If you add an
authenticated surface to the web app, mount the handler there too and sign in
separately on each origin.

### Production (single parent domain)

If both apps live under one parent domain (`app.example.com`,
`admin.example.com`), enable cross-subdomain cookies:

```ts
export const auth = betterAuth({
  // ...
  advanced: {
    crossSubDomainCookies: { enabled: true, domain: ".example.com" }, // leading dot
  },
});
```

Then a sign-in on one subdomain authenticates the user on the other.

## Adding a new auth method

Add the plugin in `packages/auth/src/server.ts`, then regenerate and migrate:

```ts
import { magicLink } from "better-auth/plugins";

plugins: [
  // ...
  magicLink({
    sendMagicLink: async ({ email, url }) => {
      await sendEmail({ to: email, subject: "Sign in", html: `<a href="${url}">Sign in</a>` });
    },
  }),
];
```

```bash
pnpm auth:gen-schema   # Better Auth — emits schema additions into schema.prisma
pnpm db:migrate:dev    # author + apply the migration
pnpm db:generate       # refresh the client types
```

## User management Server Actions

Admin user operations live in `apps/admin/app/(dashboard)/users/_actions.ts` and
call Better Auth's admin API:

- `inviteUserAction` — `auth.api.createUser` with a generated temp password
- `banUserAction` / `unbanUserAction` — `auth.api.banUser` / `unbanUser`, then
  `revokeUserSessions` so a ban takes effect immediately
- `removeUserAction` — revoke sessions, then `auth.api.removeUser`
- `resetUserPasswordAction` — `setUserPassword` + `revokeUserSessions`

Each guards with `requireAdmin()` first. The profile page
(`/profile`) lets a user revoke their own device sessions via
`revokeMySessionAction`.

## Troubleshooting

### "Session is null on first load after sign-in"

`nextCookies()` must be **last** in the plugins array — Server Actions can't
write `Set-Cookie` synchronously without it.

### "Invalid signature" errors

`BETTER_AUTH_SECRET` doesn't match between the cookie and the server. Ensure
both apps share the same secret and that you restarted after editing
`.env.local`.

### "OAuth redirect URI mismatch"

In Google Cloud Console, the authorized redirect URI must be
`<BETTER_AUTH_URL>/api/auth/callback/google` — e.g.
`http://localhost:3001/api/auth/callback/google` for local admin.

### "Forbidden" when I'm clearly an admin

Check the `user.role` value in the database. If you just changed it, sign out
and back in (or delete the session row) to refresh.
