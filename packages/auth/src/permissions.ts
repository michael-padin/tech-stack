import type { AppRole } from "@repo/types";

// ── Permission model ────────────────────────────────────────────────────────
// A small, capability-based RBAC layer that sits on top of Better Auth's role
// field. Roles map to a set of capabilities; route/action guards check a
// capability rather than hard-coding role names, so adding a role later is a
// data change here, not a sweep through call sites.
//
// Capabilities are namespaced `resource.action`. Keep this list as the single
// source of truth — when you add a resource, extend `Capability` and the
// `ROLE_CAPABILITIES` map below.

export type Capability =
  | "items.read"
  | "items.create"
  | "items.update"
  | "items.delete"
  | "users.read"
  | "users.manage"
  | "audit.read"
  | "settings.manage";

const ALL_CAPABILITIES: readonly Capability[] = [
  "items.read",
  "items.create",
  "items.update",
  "items.delete",
  "users.read",
  "users.manage",
  "audit.read",
  "settings.manage",
];

// Per-role capability grants. `admin` gets everything; `editor` can work with
// items but not manage users/settings; `viewer` is read-only.
export const ROLE_CAPABILITIES: Record<AppRole, readonly Capability[]> = {
  admin: ALL_CAPABILITIES,
  editor: ["items.read", "items.create", "items.update", "items.delete"],
  viewer: ["items.read"],
};

// Numeric rank for "at least this role" checks (e.g. `requireRole("editor")`
// should also admit admins). Higher = more privileged.
export const ROLE_RANK: Record<AppRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
};

const KNOWN_ROLES = new Set<string>(["admin", "editor", "viewer"]);

/** Narrow an unknown role string to a valid `AppRole`, or `null`. */
export function parseRole(role: unknown): AppRole | null {
  return typeof role === "string" && KNOWN_ROLES.has(role) ? (role as AppRole) : null;
}

/** The minimal user shape these checks need — matches Better Auth's session user. */
export interface RoleUser {
  role?: string | null;
}

/** True when the user's role grants the given capability. */
export function hasPermission(user: RoleUser | null | undefined, capability: Capability): boolean {
  const role = parseRole(user?.role);
  if (!role) {
    return false;
  }
  return ROLE_CAPABILITIES[role].includes(capability);
}

/** The user's role and every capability it grants (empty for an unknown role). */
export function capabilitiesFor(user: RoleUser | null | undefined): {
  role: AppRole | null;
  list: readonly Capability[];
} {
  const role = parseRole(user?.role);
  return { role, list: role ? ROLE_CAPABILITIES[role] : [] };
}

/** True when the user holds one of the allowed roles. */
export function hasRole(user: RoleUser | null | undefined, ...roles: AppRole[]): boolean {
  const role = parseRole(user?.role);
  return role !== null && roles.includes(role);
}

/** True when the user's role rank is at least that of `minimumRole`. */
export function hasAtLeastRole(user: RoleUser | null | undefined, minimumRole: AppRole): boolean {
  const role = parseRole(user?.role);
  return role !== null && ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}
