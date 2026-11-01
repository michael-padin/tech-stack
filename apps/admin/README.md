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

## Routes

| Path          | What it is                       | Required role |
| ------------- | -------------------------------- | ------------- |
| `/`           | Overview                         | admin         |
| `/items`      | Item list, filters, pagination   | admin         |
| `/items/new`  | Create an item                   | admin         |
| `/items/[id]` | Edit / delete an item            | admin         |
| `/users`      | Invite, ban, remove, reset users | admin         |
| `/profile`    | Your account and sessions        | admin         |
| `/help`       | How the dashboard works          | admin         |
| `/sign-in`    | Email + password sign-in         | (anonymous)   |
| `/forbidden`  | Shown when a gate rejects you    | (anonymous)   |

## Adding an admin route

```tsx
// app/(dashboard)/widgets/page.tsx — the (dashboard) layout renders the shell
import { requireAdmin } from "@repo/auth/next";
import { listWidgets } from "@repo/db/queries/widgets";

export default async function WidgetsPage() {
  await requireAdmin();
  const widgets = await listWidgets();

  return <main className="p-8">{/* page content */}</main>;
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
