"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireCapability } from "@repo/auth/next";
import { createItem, getItemById, softDeleteItem, updateItem } from "@repo/db/queries/items";
import { itemInputSchema, type ItemInput } from "@repo/types";

import { type ActionResult, actionError, actionOk } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cached-data";
import { revalidateWeb } from "@/lib/revalidate-web";

// Every item mutation invalidates the admin's cached reads (overview summary)
// and asks the public web app to drop its cached list and the item's page.
function invalidateItemsCache(id: string) {
  updateTag(CACHE_TAGS.items);
  revalidateWeb(["public-items", `item:${id}`]);
}

export async function createItemAction(input: ItemInput): Promise<ActionResult> {
  const session = await requireCapability("items.create");
  let id: string;
  try {
    const parsed = itemInputSchema.parse(input);
    ({ id } = await createItem(parsed, session.user.id));
    await audit(session.user, {
      action: "item.create",
      entity: "item",
      entityId: id,
      summary: `Created "${parsed.title}"`,
      after: parsed,
    });
  } catch (error) {
    return actionError(error, "Couldn't create item.");
  }
  invalidateItemsCache(id);
  redirect(`/items/${id}`);
}

export async function updateItemAction(id: string, input: ItemInput): Promise<ActionResult> {
  const session = await requireCapability("items.update");
  try {
    const parsed = itemInputSchema.parse(input);
    const before = await getItemById(id);
    await updateItem(id, parsed);
    await audit(session.user, {
      action: "item.update",
      entity: "item",
      entityId: id,
      summary: `Updated "${parsed.title}"`,
      before,
      after: parsed,
    });
  } catch (error) {
    return actionError(error, "Couldn't save item.");
  }
  invalidateItemsCache(id);
  return actionOk;
}

// No redirect: the list row stays on its page and filters; the detail page
// navigates back to /items itself.
export async function deleteItemAction(id: string): Promise<ActionResult> {
  const session = await requireCapability("items.delete");
  try {
    const before = await getItemById(id);
    await softDeleteItem(id);
    await audit(session.user, {
      action: "item.delete",
      entity: "item",
      entityId: id,
      summary: before ? `Deleted "${before.title}"` : "Deleted",
      before,
    });
  } catch (error) {
    return actionError(error, "Couldn't delete item.");
  }
  invalidateItemsCache(id);
  return actionOk;
}
