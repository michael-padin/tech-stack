"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@repo/auth/next";
import { createItem, softDeleteItem, updateItem } from "@repo/db/queries/items";
import { itemInputSchema, type ItemInput } from "@repo/types";

import { CACHE_TAGS } from "@/lib/cached-data";

// One tag per resource — mutating actions invalidate it so the next read is
// fresh (overview summary + list reads both hang off CACHE_TAGS.items).
function invalidateItemsCache() {
  updateTag(CACHE_TAGS.items);
}

export async function createItemAction(input: ItemInput) {
  const session = await requireAdmin();
  const parsed = itemInputSchema.parse(input);
  const { id } = await createItem(parsed, session.user.id);
  invalidateItemsCache();
  redirect(`/items/${id}`);
}

export async function updateItemAction(id: string, input: ItemInput) {
  await requireAdmin();
  const parsed = itemInputSchema.parse(input);
  await updateItem(id, parsed);
  invalidateItemsCache();
}

export async function deleteItemAction(id: string) {
  await requireAdmin();
  await softDeleteItem(id);
  invalidateItemsCache();
  redirect("/items");
}
