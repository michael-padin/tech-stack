import { headers as nextHeaders } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { toNextJsHandler } from "better-auth/next-js";

import type { AppRole } from "@repo/types";
import { type Capability, hasPermission, hasRole, type RoleUser } from "./permissions";
import { auth } from "./server";

export const { GET, POST } = toNextJsHandler(auth);

// cache() dedupes the lookup per request: the layout, the page and its
// components can all gate without each paying a session query.
const getServerSession = cache(async () => auth.api.getSession({ headers: await nextHeaders() }));

// Better Auth's admin plugin attaches role/banned/banExpires to user; those
// types aren't re-exported, so we narrow against the documented shape.
type GuardedUser = RoleUser & {
  banned?: boolean | null;
  banExpires?: Date | string | null;
};

/**
 * Returns `true` when the user is actively banned (a permanent ban, or a
 * temporary ban that hasn't expired). Past expiry dates fall through.
 */
function isBanned(user: GuardedUser): boolean {
  if (!user.banned) {
    return false;
  }
  const expiresAt = user.banExpires ? new Date(user.banExpires) : null;
  return !expiresAt || expiresAt.getTime() > Date.now();
}

/**
 * Gate on "signed in and not banned", whatever the role. Use it for surfaces
 * every role may see (the dashboard shell, your own profile); gate resources
 * with `requireCapability`.
 */
export async function requireSession() {
  const session = await getServerSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (isBanned(session.user as GuardedUser)) {
    redirect("/forbidden");
  }
  return session;
}

/**
 * Source-of-truth gate for admin-only surfaces. Redirects to `redirectTo`
 * (default `/sign-in`) when unauthenticated, or `/forbidden` when the user is
 * not an admin or is banned. Kept for backward compatibility — prefer
 * `requireCapability` / `requireRole` for non-admin roles.
 */
export async function requireAdmin(redirectTo = "/sign-in") {
  const session = await getServerSession();
  if (!session) {
    redirect(redirectTo);
  }
  const user = session.user as GuardedUser;
  if (user.role !== "admin") {
    redirect("/forbidden");
  }
  if (isBanned(user)) {
    redirect("/forbidden");
  }
  return session;
}

/**
 * Gate a surface on one of the given roles. Redirects to `/sign-in` when
 * unauthenticated, `/forbidden` when the user's role isn't in `roles` or the
 * user is banned. Same redirect conventions as `requireAdmin`.
 */
export async function requireRole(...roles: AppRole[]) {
  const session = await getServerSession();
  if (!session) {
    redirect("/sign-in");
  }
  const user = session.user as GuardedUser;
  if (isBanned(user) || !hasRole(user, ...roles)) {
    redirect("/forbidden");
  }
  return session;
}

/**
 * Gate a surface on a capability (e.g. `"items.update"`). Resolves the user's
 * role to its capability set via the permission map. Redirects to `/sign-in`
 * when unauthenticated, `/forbidden` when the capability isn't granted or the
 * user is banned.
 */
export async function requireCapability(capability: Capability) {
  const session = await getServerSession();
  if (!session) {
    redirect("/sign-in");
  }
  const user = session.user as GuardedUser;
  if (isBanned(user) || !hasPermission(user, capability)) {
    redirect("/forbidden");
  }
  return session;
}
