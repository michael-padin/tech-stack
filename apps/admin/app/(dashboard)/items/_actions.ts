"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@repo/auth/next";
import { createItem, softDeleteItem, updateItem } from "@repo/db/queries/items";
import { itemInputSchema, type ItemInput } from "@repo/types";

import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { CACHE_TAGS } from "@/lib/cached-data";
import { revalidateWeb } from "@/lib/revalidate-web";

// Every item mutation invalidates the admin's cached reads (overview summary)
// and asks the public web app to drop its cached list and the item's page.
function invalidateItemsCache(id: string) {
  updateTag(CACHE_TAGS.items);
  revalidateWeb(["public-items", `item:${id}`]);
}

export async function createItemAction(input: ItemInput): Promise<ActionResult> {
  const session = await requireAdmin();
  let id: string;
  try {
    const parsed = itemInputSchema.parse(input);
    ({ id } = await createItem(parsed, session.user.id));
  } catch (error) {
    return actionError(error, "Couldn't create item.");
  }
  invalidateItemsCache(id);
  redirect(`/items/${id}`);
}

export async function updateItemAction(id: string, input: ItemInput): Promise<ActionResult> {
  await requireAdmin();
  try {
    const parsed = itemInputSchema.parse(input);
    await updateItem(id, parsed);
  } catch (error) {
    return actionError(error, "Couldn't save item.");
  }
  invalidateItemsCache(id);
  return actionOk;
}

// No redirect: the list row stays on its page and filters; the detail page
// navigates back to /items itself.
export async function deleteItemAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await softDeleteItem(id);
  } catch (error) {
    return actionError(error, "Couldn't delete item.");
  }
  invalidateItemsCache(id);
  return actionOk;
}
