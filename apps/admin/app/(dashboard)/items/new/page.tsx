import { requireCapability } from "@repo/auth/next";

import { createItemAction } from "../_actions";
import { ItemForm } from "../_components/item-form";

export const metadata = {
  title: "New item",
};

export default async function NewItemPage() {
  await requireCapability("items.create");

  return (
    <>
      <header className="border-border/60 border-b">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-8 sm:py-6">
          <h1 className="text-lg leading-tight font-semibold sm:text-xl">New item</h1>
          <p className="text-muted-foreground mt-0.5 max-w-prose text-xs sm:text-sm">
            Create a new item. It starts as a draft until you set it active.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
        <ItemForm onSubmit={createItemAction} submitLabel="Create item" />
      </main>
    </>
  );
}
