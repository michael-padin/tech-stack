import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageIcon, PlusIcon, SearchIcon } from "lucide-react";

import { requireAdmin } from "@repo/auth/next";
import { listItemsPaginated } from "@repo/db/queries/items";
import { itemFilterSchema, pageQuerySchema, type ItemFilters } from "@repo/types";

import { buttonVariants } from "@repo/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ListPagination } from "@/components/list-pagination";
import { DEFAULT_PAGE_SIZE, resolvePageSize } from "@/components/pagination-helpers";

import { ItemsFilters } from "./_components/items-filters";
import { ItemsTable } from "./_components/items-table";

type SearchParams = {
  search?: string;
  status?: string;
  page?: string;
  per_page?: string;
};

export default async function ItemsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;

  // Filters come from the URL — partial() lets each param fall back to its
  // schema default independently.
  const filters = itemFilterSchema.partial().parse({
    search: params.search,
    status: params.status,
  });
  // `per_page` drives the shared pagination controls; feed it through the
  // canonical PageQuery so the db layer sees a validated shape.
  const pageSize = resolvePageSize(params.per_page);
  const page = pageQuerySchema.parse({ page: params.page, pageSize });

  const search = filters.search ?? "";
  const status = filters.status ?? "all";

  return (
    <>
      <header className="border-border/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg leading-tight font-semibold sm:text-xl">Items</h1>
            <p className="text-muted-foreground mt-0.5 max-w-prose text-xs sm:text-sm">
              The example CRUD resource. Swap it for your own domain entity.
            </p>
          </div>
          <Link href="/items/new" className={buttonVariants({ size: "sm" })}>
            <PlusIcon aria-hidden="true" /> New item
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <ItemsFilters defaultSearch={search} defaultStatus={status} />

        <div className="mt-6">
          <Suspense
            key={`${search}-${status}-${page.page}-${pageSize}`}
            fallback={<TableSkeleton />}
          >
            <ItemsBody filters={filters} page={page.page} pageSize={pageSize} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function ItemsBody({
  filters,
  page,
  pageSize,
}: {
  filters: Partial<ItemFilters>;
  page: number;
  pageSize: number;
}) {
  const result = await listItemsPaginated(filters, { page, pageSize });
  // A stale or hand-edited ?page= past the end shows the last page instead of
  // a misleading "No items yet".
  if (result.rows.length === 0 && result.total > 0) {
    const params = new URLSearchParams({ page: String(result.pageCount) });
    if (filters.search) params.set("search", filters.search);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set("per_page", String(pageSize));
    redirect(`/items?${params.toString()}`);
  }
  const isFiltered = Boolean(filters.search) || (filters.status && filters.status !== "all");

  if (result.rows.length === 0) {
    return (
      <Empty className="bg-card border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {isFiltered ? <SearchIcon aria-hidden="true" /> : <PackageIcon aria-hidden="true" />}
          </EmptyMedia>
          <EmptyTitle>{isFiltered ? "No matches" : "No items yet"}</EmptyTitle>
          <EmptyDescription>
            {isFiltered
              ? "Nothing matches the current filters. Clear them or broaden the search."
              : "The catalog is empty. Create the first item to get started."}
          </EmptyDescription>
        </EmptyHeader>
        {isFiltered ? null : (
          <EmptyContent>
            <Link href="/items/new" className={buttonVariants()}>
              <PlusIcon aria-hidden="true" /> New item
            </Link>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  const baseQuery: Record<string, string | undefined> = {
    search: filters.search || undefined,
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
  };

  return (
    <>
      <ItemsTable items={result.rows} />
      <ListPagination
        page={result.page}
        pageCount={result.pageCount}
        basePath="/items"
        baseQuery={baseQuery}
        totalCount={result.total}
        pageSize={pageSize}
      />
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="border-border/60 overflow-hidden rounded-lg border">
      {["r1", "r2", "r3", "r4", "r5"].map((key) => (
        <div
          key={key}
          className="border-border/60 flex items-center gap-3 border-b px-4 py-3 last:border-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
