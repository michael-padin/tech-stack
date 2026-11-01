# @repo/admin — Management Dashboard

Next.js 16 app, port 3001. The whole app is gated — every signed-in user
must have the `admin` role to access anything except `/sign-in` and
`/forbidden`.

## What lives here

```
apps/admin/
├── app/
│   ├── api/auth/[...all]/      Better Auth handler
│   ├── sign-in/                Anonymous-accessible
│   ├── forbidden/              Shown when role is too low
│   ├── globals.css             Imports @repo/ui/styles.css
│   ├── layout.tsx              Same fonts as apps/web
│   └── page.tsx                Overview / dashboard home
├── components/
│   └── admin-shell.tsx         Sidebar + content layout
├── proxy.ts                    Gates everything except sign-in/forbidden
└── ...
```

## Routes (current vs planned)

| Path         | Status               | Required role |
| ------------ | -------------------- | ------------- |
| `/`          | ✅ Built             | admin         |
| `/sign-in`   | ✅ Built             | (anonymous)   |
| `/forbidden` | ✅ Built             | (anonymous)   |
| `/points`    | 🚧 Sidebar link only | admin         |
| `/reports`   | 🚧 Sidebar link only | admin         |
| `/areas`     | 🚧 Sidebar link only | admin         |
| `/users`     | 🚧 Sidebar link only | admin         |

The sidebar in `components/admin-shell.tsx` lists all of them; build out
the page files as you implement each.

## Adding an admin route

```tsx
// app/points/page.tsx
import { requireAdmin } from "@repo/auth/next";
import { getDb, listPublicPoints } from "@repo/db";

import { AdminShell } from "@/components/admin-shell";

export default async function PointsPage() {
  const session = await requireAdmin();
  const points = await listPublicPoints(getDb());

  return (
    <AdminShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: "admin",
      }}
    >
      <div className="p-8">{/* page content */}</div>
    </AdminShell>
  );
}
```

The proxy already gates the route — the `requireAdmin()` call is the real
authorization decision.

## Sharing sessions with apps/web

In dev they're separate origins (3000 / 3001), so users sign in on each
app independently. In prod, set the cookie domain to a parent domain — see
[Authentication → Sharing sessions across apps](../../docs/04-authentication.md#sharing-sessions-across-apps).

## Run it

```bash
pnpm dev:admin
```

Open http://localhost:3001 — you'll be redirected to `/sign-in`.

## First admin

```bash
pnpm auth:create-admin you@example.com "Your Name"
```

Sign in with the printed temporary password. The dashboard now loads.
