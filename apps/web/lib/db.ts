// Falls back to the seed dataset when DATABASE_URL is unset so the template
// boots and demos with zero database setup (see @repo/db/seed-data).

import { cacheLife, cacheTag } from "next/cache";

import { getItemById, listItems } from "@repo/db/queries/items";
import { fallbackItems } from "@repo/db/seed-data";
import type { Item, ItemFilters } from "@repo/types";

import { env } from "@/env";

export function isDbConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

export const PUBLIC_ITEMS_TAG = "public-items";

/**
 * Per-detail cache tag. Editing item X invalidates only this tag (and the
 * list tag), so other cached detail pages stay warm.
 */
export const publicItemTag = (id: string) => `item:${id}` as const;

async function cachedListItems(filters?: Partial<ItemFilters>): Promise<Item[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(PUBLIC_ITEMS_TAG);
  return listItems(filters);
}

async function cachedGetItemById(id: string): Promise<Item | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(publicItemTag(id));
  return getItemById(id);
}

/** Apply the same filter/sort semantics as the DB query, in memory. */
function filterFallbackItems(filters?: Partial<ItemFilters>): Item[] {
  const search = (filters?.search ?? "").trim().toLowerCase();
  const status = filters?.status ?? "all";
  const sort = filters?.sort ?? "recent";

  const rows = fallbackItems().filter((item) => {
    const matchesSearch = search ? item.title.toLowerCase().includes(search) : true;
    const matchesStatus = status === "all" ? true : item.status === status;
    return matchesSearch && matchesStatus;
  });

  rows.sort((a, b) =>
    sort === "title" ? a.title.localeCompare(b.title) : b.createdAt.localeCompare(a.createdAt),
  );

  return rows;
}

export async function fetchItems(filters?: Partial<ItemFilters>): Promise<Item[]> {
  if (!isDbConfigured()) {
    return filterFallbackItems(filters);
  }
  return cachedListItems(filters);
}

export async function fetchItemById(id: string): Promise<Item | null> {
  if (!isDbConfigured()) {
    return fallbackItems().find((item) => item.id === id) ?? null;
  }
  return cachedGetItemById(id);
}
