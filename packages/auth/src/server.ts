import { prisma } from "@repo/db/client";
import { APP_NAME } from "@repo/env/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { accessControl, accessControlRoles } from "./access-control";
import { auditAdminActions } from "./audit-hook";
import { keys } from "./keys";

const env = keys();

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // No public sign-up: accounts are created by an admin (the /users invite
  // flow) or, for the very first admin, by `pnpm auth:create-admin`.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            // Google can sign in existing accounts but never create new ones.
            disableImplicitSignUp: true,
          },
        }
      : undefined,

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // cookieCache temporarily disabled — with it on, session.user fields
    // (banned, role, email…) snapshot into the cookie and stay stale for the
    // TTL, so admin-driven mutations on a user lag from that user's POV.
    // Re-enable once admin mutations explicitly invalidate the cookie cache.
    // cookieCache: {
    //   enabled: true,
    //   maxAge: 5 * 60,
    // },
  },

  // Brute-force protection. Better Auth tightens the limits on its known
  // sensitive endpoints (sign-in, password reset) on top of these defaults.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },

  // Database joins fuse session+user reads into a single query — important on
  // Neon serverless where every round-trip is a separate WebSocket exchange.
  advanced: { database: { joins: true } },

  // Every admin-API write lands in the audit log (see ./audit-hook).
  hooks: { after: auditAdminActions },

  plugins: [
    // Multi-role RBAC. `roles` lists every assignable role; `adminRoles` is the
    // subset granted access to the admin plugin's API (`/api/auth/admin/*`).
    //
    // `defaultRole` is the least-privileged role; invites pick a role
    // explicitly, and the first admin comes from `pnpm auth:create-admin` (see
    // docs/04-authentication.md → "Bootstrapping the first admin").
    admin({
      defaultRole: "viewer",
      // `ac` + `roles` teach the admin plugin our `admin | editor | viewer`
      // access-control roles (defined in ./access-control). `adminRoles` is the
      // subset granted access to the admin API (`/api/auth/admin/*`).
      ac: accessControl,
      roles: accessControlRoles,
      adminRoles: ["admin"],
    }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
