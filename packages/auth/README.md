# @repo/auth

Better Auth instance + Next.js helpers, shared across `apps/web` and
`apps/admin`.

For the conceptual overview (roles, session lifecycle, protecting routes),
see [docs/04-authentication.md](../../docs/04-authentication.md).

## Exports

```ts
// Server-only — uses the @repo/db connection.
import { auth, type Auth, type Session } from "@repo/auth/server";

// Client-only — uses fetch against /api/auth/*
import { authClient, useSession, signIn, signOut, signUp } from "@repo/auth/client";

// Next.js 16 helpers — Server Components, Route Handlers, proxy.ts
import {
  GET,
  POST, // route handler for /api/auth/[...all]
  requireAdmin,
} from "@repo/auth/next";
```

## Wiring up a Next.js app

### 1. Mount the route handler

```ts
// app/api/auth/[...all]/route.ts
export { GET, POST } from "@repo/auth/next";
```

### 2. Add the proxy

```ts
// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const cookie = getSessionCookie(request);
  if (!cookie && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
```

### 3. Use in Server Components

```tsx
import { requireAdmin } from "@repo/auth/next";

export default async function AdminPage() {
  const session = await requireAdmin();
  return <div>Hello {session.user.name}</div>;
}
```

## Roles

Roles are `admin | editor | viewer` (see `src/permissions.ts`). Better
Auth's `admin` plugin is loaded with `defaultRole: "viewer"` and
`adminRoles: ["admin"]`. Public sign-up is disabled; the first admin comes
from `pnpm auth:create-admin <email> "<name>"`. `requireAdmin()` redirects to `/sign-in` (no session)
or `/forbidden` (signed in but role isn't `admin`).

## Adding a new auth method

```ts
// src/server.ts
import { magicLink } from "better-auth/plugins";

plugins: [
  // ...existing
  magicLink({
    sendMagicLink: async ({ email, url }) => {
      await myEmailSender.send({ to: email, url });
    },
  }),
];
```

After plugin changes, regenerate the Better Auth schema if needed:

```bash
pnpm auth:gen-schema
pnpm db:generate
pnpm db:migrate
```

## Configuration

All env vars are read from `process.env`. Required:

- `BETTER_AUTH_SECRET` — must match across both apps
- `BETTER_AUTH_URL` — canonical URL of _this_ app
- `DATABASE_URL` — set by `@repo/db`

Optional:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — both required to enable
  Google sign-in
