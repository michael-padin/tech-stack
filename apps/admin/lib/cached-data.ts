import { unstable_cache } from "next/cache";

import { getAdminSummary as fetchAdminSummary } from "@repo/db/queries/summary";

/**
 * Cache tags consumed by `updateTag(...)` in server actions. Add one tag per
 * resource; mutating actions invalidate their tag so the next read is fresh.
 */
export const CACHE_TAGS = {
  items: "items",
} as const;

/**
 * Cached overview aggregates — the per-status count query collapsed to one
 * cached read. Every item mutation invalidates `CACHE_TAGS.items`.
 *
 * `revalidate: 60` is a safety net for misses on the tag-invalidation path.
 */
export const getCachedAdminSummary = unstable_cache(() => fetchAdminSummary(), ["admin:summary"], {
  tags: [CACHE_TAGS.items],
  revalidate: 60,
});
