"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";

import { PageSizeSelect } from "./page-size-select";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "./pagination-helpers";

interface ListPaginationProps {
  /** 1-indexed current page. */
  page: number;
  /** Total number of pages (≥ 1). */
  pageCount: number;
  /** Pathname for the list page, e.g. `/points`. */
  basePath: string;
  /** Existing query params to preserve (everything except `page`). */
  baseQuery: Record<string, string | undefined>;
  /** Total item count for the "Showing X–Y of Z" summary. */
  totalCount: number;
  /** Page size — used for the summary and propagated through page links. */
  pageSize: number;
  /** Show the rows-per-page picker. Defaults to `true`. */
  showPageSize?: boolean;
}

function pageHref(
  basePath: string,
  baseQuery: Record<string, string | undefined>,
  pageSize: number,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(baseQuery)) {
    if (v) params.set(k, v);
  }
  if (pageSize !== DEFAULT_PAGE_SIZE) params.set("per_page", String(pageSize));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Returns a 1-indexed list of page numbers + ellipses for the visible range.
 * Always shows first, last, current ±1, and ellipses between.
 */
function buildPageItems(page: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push("ellipsis");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < pageCount - 1) items.push("ellipsis");
  items.push(pageCount);
  return items;
}

export function ListPagination({
  page,
  pageCount,
  basePath,
  baseQuery,
  totalCount,
  pageSize,
  showPageSize = true,
}: ListPaginationProps) {
  const pageSizeControl = showPageSize ? (
    <PageSizeSelect
      value={pageSize}
      options={[...PAGE_SIZE_OPTIONS]}
      basePath={basePath}
      baseQuery={baseQuery}
    />
  ) : null;

  // Nothing to paginate — just show a result count so the list still has
  // a footer summary. The page-size picker stays while the result count could
  // still span pages at a smaller size, so a larger choice can be undone.
  if (pageCount <= 1) {
    return (
      <div className="text-muted-foreground mt-4 flex items-center gap-3 text-xs tabular-nums">
        <p>
          {totalCount === 0 ? "No results" : `${totalCount} result${totalCount === 1 ? "" : "s"}`}
        </p>
        {totalCount > Math.min(...PAGE_SIZE_OPTIONS) ? pageSizeControl : null}
      </div>
    );
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(totalCount, page * pageSize);
  const items = buildPageItems(page, pageCount);
  const prevHref = pageHref(basePath, baseQuery, pageSize, Math.max(1, page - 1));
  const nextHref = pageHref(basePath, baseQuery, pageSize, Math.min(pageCount, page + 1));
  const prevDisabled = page <= 1;
  const nextDisabled = page >= pageCount;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="text-muted-foreground flex items-center gap-3 text-xs tabular-nums">
        <span>
          Showing <span className="text-foreground font-medium">{first}</span>–
          <span className="text-foreground font-medium">{last}</span> of{" "}
          <span className="text-foreground font-medium">{totalCount}</span>
        </span>
        {pageSizeControl}
      </div>
      <Pagination className="mx-0 ml-auto w-fit">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={prevHref}
              aria-disabled={prevDisabled || undefined}
              tabIndex={prevDisabled ? -1 : undefined}
              className={prevDisabled ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
          {items.map((item, i) => {
            const prev = items[i - 1];
            return item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-after-${typeof prev === "number" ? prev : "start"}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  href={pageHref(basePath, baseQuery, pageSize, item)}
                  isActive={item === page}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          <PaginationItem>
            <PaginationNext
              href={nextHref}
              aria-disabled={nextDisabled || undefined}
              tabIndex={nextDisabled ? -1 : undefined}
              className={nextDisabled ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
