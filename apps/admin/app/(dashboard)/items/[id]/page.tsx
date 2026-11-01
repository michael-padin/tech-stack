import { notFound } from "next/navigation";

import { requireAdmin } from "@repo/auth/next";
import { getItemById } from "@repo/db/queries/items";

import { StatusPill } from "@/components/status-pill";

import { updateItemAction } from "../_actions";
import { ItemDeleteButton } from "../_components/item-delete-button";
import { ItemForm } from "../_components/item-form";

export const metadata = {
  title: "Edit item",
};

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const item = await getItemById(id);
  if (!item) notFound();

  return (
    <>
      <header className="border-border/60 border-b">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <h1 className="truncate text-lg leading-tight font-semibold sm:text-xl">
              {item.title}
            </h1>
            <StatusPill status={item.status} />
          </div>
          <ItemDeleteButton itemId={item.id} itemTitle={item.title} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
        <ItemForm
          item={item}
          onSubmit={updateItemAction.bind(null, item.id)}
          submitLabel="Save changes"
        />
      </main>
    </>
  );
}
