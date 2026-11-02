import Link from "next/link";
import { format } from "date-fns";

import { APP_NAME } from "@repo/env/client";
import { itemFilterSchema, type Item, type ItemFilters } from "@repo/types";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/native-select";

import { BrandMark } from "@/components/brand-mark";
import { StatusBadge } from "@/components/status-badge";
import { fetchItems } from "@/lib/db";

const SORT_OPTIONS: { value: ItemFilters["sort"]; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "title", label: "Title (A–Z)" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = itemFilterSchema.parse(await searchParams);
  const items = await fetchItems(filters);

  return (
    <main className="bg-background min-h-svh">
      <header className="border-border/60 border-b px-6 py-5 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="text-primary size-5" />
            <span className="display text-lg leading-none">{APP_NAME}</span>
          </Link>
          <Link
            href="/help"
            className="text-muted-foreground hover:text-foreground text-[0.68rem] tracking-[0.22em] uppercase transition-colors"
          >
            About
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <p className="text-muted-foreground text-[0.68rem] tracking-[0.22em] uppercase">Items</p>
        <h1 className="display mt-2 text-3xl leading-tight sm:text-4xl">Browse the catalog</h1>

        <FilterBar filters={filters} />

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// Server-component-friendly filter bar: a plain GET form, no client JS. The
// browser serializes inputs into the query string Next.js reads on the server.
function FilterBar({ filters }: { filters: ItemFilters }) {
  return (
    <form method="get" className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          name="search"
          type="search"
          defaultValue={filters.search}
          placeholder="Search by title…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sort">Sort</Label>
        <NativeSelect id="sort" name="sort" defaultValue={filters.sort} className="w-full sm:w-44">
          {SORT_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit">Apply</Button>
    </form>
  );
}

function ItemCard({ item }: { item: Item }) {
  return (
    <Card className="hover:ring-foreground/20 h-full transition-shadow">
      <Link href={`/items/${item.id}`} className="flex h-full flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
            <StatusBadge status={item.status} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {item.description ? (
            <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
              {item.description}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm italic">No description.</p>
          )}
          <p className="text-muted-foreground mt-auto pt-4 font-mono text-xs tabular-nums">
            Updated {format(new Date(item.updatedAt), "MMM d, yyyy")}
          </p>
        </CardContent>
      </Link>
    </Card>
  );
}

function EmptyState() {
  return (
    <Empty className="mt-8 py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BrandMark className="text-muted-foreground size-4" />
        </EmptyMedia>
        <EmptyTitle>No items found</EmptyTitle>
        <EmptyDescription>Try a different search.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
