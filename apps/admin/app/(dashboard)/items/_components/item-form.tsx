"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import {
  itemInputSchema,
  STATUS_LABELS,
  type Item,
  type ItemInput,
  type ItemStatus,
} from "@repo/types";

// The schema's `.default("draft")` makes `status` optional on the form's input
// shape but required on its parsed output. Splitting the two keeps RHF's field
// values (input) and the submit handler (output = ItemInput) correctly typed.
type ItemFormValues = z.input<typeof itemInputSchema>;

import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/native-select";
import { toast } from "@repo/ui/components/sonner";
import { Textarea } from "@repo/ui/components/textarea";

import type { ActionResult } from "@/lib/action-result";

const STATUS_OPTIONS: ItemStatus[] = ["draft", "active", "archived"];

type ItemFormProps = {
  /** Existing item in edit mode; omit for create. */
  item?: Item;
  /**
   * Server action that persists the input. Create actions redirect on success;
   * update actions return { ok } and we refresh in place.
   */
  onSubmit: (input: ItemInput) => Promise<ActionResult>;
  submitLabel: string;
  /** Show the values without letting the user change them (e.g. viewers). */
  readOnly?: boolean;
};

export function ItemForm({ item, onSubmit, submitLabel, readOnly = false }: ItemFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = item !== undefined;

  const form = useForm<ItemFormValues, unknown, ItemInput>({
    resolver: zodResolver(itemInputSchema),
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? "",
      status: item?.status ?? "draft",
    },
  });

  function handleSubmit(values: ItemInput) {
    startTransition(async () => {
      const result = await onSubmit({
        title: values.title.trim(),
        description: values.description?.trim() ? values.description.trim() : null,
        status: values.status,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // A successful create redirects, so only edits reach this point —
      // surface success and pull in the fresh server data.
      if (isEdit) {
        toast.success("Item saved.");
        form.reset(values);
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <Card className="p-5 sm:p-6">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-5">
          {/* A disabled fieldset disables every control inside it natively. */}
          <fieldset disabled={readOnly} className="contents">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Quarterly report" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Optional context for this item."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>Optional. Up to 2000 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <NativeSelect
                      className="w-full"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <NativeSelectOption key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/items")}
              disabled={pending}
            >
              {readOnly ? "Back" : "Cancel"}
            </Button>
            {readOnly ? null : (
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : submitLabel}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </Form>
  );
}
