import { z } from "zod";

// ── Enums ─────────────────────────────────────────────────────────────────
export const itemStatusSchema = z.enum(["draft", "active", "archived"]);
// Multi-role RBAC: `admin` (full), `editor` (read + create/update items),
// `viewer` (read-only). The capability map lives in @repo/auth.
export const appRoleSchema = z.enum(["admin", "editor", "viewer"]);

// ── Item (the example resource) ───────────────────────────────────────────
// Serialized shape returned to the apps. Dates are ISO strings so the payload
// crosses the server/client boundary without Date-instance hydration issues.
export const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: itemStatusSchema,
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Input shape for create/edit — validated in server actions and API routes.
export const itemInputSchema = z.object({
  title: z.string().min(2, "Title is required.").max(200, "Title is too long."),
  description: z.string().max(2000, "Description is too long.").nullable().optional(),
  status: itemStatusSchema.default("draft"),
});

// Filter/sort state — parsed from URL search params (see finder-state pattern).
// Every field `.catch()`es to its default: a hand-edited or stale URL
// (`?status=bogus`, `?search=a&search=b`) degrades to the default view instead
// of throwing a 500.
export const itemFilterSchema = z.object({
  search: z.string().trim().default("").catch(""),
  status: itemStatusSchema.or(z.literal("all")).default("all").catch("all"),
  sort: z.enum(["recent", "title"]).default("recent").catch("recent"),
});

// Generic pagination query, reused across every admin list. Same `.catch()`
// rule as the filters: `?page=abc` or `?page=0` means page 1.
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).catch(20),
});

// ── Audit log ───────────────────────────────────────────────────────────────
// Serialized shape returned to the apps. `metadata`/`before`/`after` are
// free-form JSON; dates are ISO strings to cross the server/client boundary.
export const auditLogSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  summary: z.string().nullable(),
  metadata: z.unknown().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
});

// Filter state for the audit-log list — parsed from URL search params.
export const auditLogFilterSchema = z.object({
  search: z.string().default(""),
  entity: z.string().default(""),
  action: z.string().default(""),
  actorId: z.string().default(""),
});

export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type AppRole = z.infer<typeof appRoleSchema>;
export type Item = z.infer<typeof itemSchema>;
export type ItemInput = z.infer<typeof itemInputSchema>;
export type ItemFilters = z.infer<typeof itemFilterSchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type AuditLogFilters = z.infer<typeof auditLogFilterSchema>;

/** Envelope for any paginated list. */
export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

// ── Presentation helpers — single source of truth for labels and UI tone. ──
export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export const STATUS_DESCRIPTIONS: Record<ItemStatus, string> = {
  draft: "Not yet published.",
  active: "Live and visible to users.",
  archived: "Retired from active use.",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Full access — manage items, users, and settings.",
  editor: "Read, create, and update items.",
  viewer: "Read-only access.",
};
