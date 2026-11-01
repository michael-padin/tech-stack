"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useTransition } from "react";

import { STATUS_LABELS, type ItemStatus } from "@repo/types";

import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

const SEARCH_DEBOUNCE_MS = 250;
const STATUS_OPTIONS: ItemStatus[] = ["draft", "active", "archived"];

export function ItemsFilters({
  defaultSearch,
  defaultStatus,
}: {
  defaultSearch: string;
  /** Current status filter, or "all" when unfiltered. */
  defaultStatus: ItemStatus | "all";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) merged.delete(key);
      else merged.set(key, value);
    }
    // Filters reset paging — a stale offset can land past the new last page.
    merged.delete("page");
    startTransition(() => router.replace(`/items${merged.size ? "?" + merged.toString() : ""}`));
  }

  function onSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      update({ search: value });
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:min-w-[260px] sm:flex-1">
        <Label htmlFor="items-search" className="sr-only">
          Search items
        </Label>
        <SearchIcon
          size={14}
          aria-hidden="true"
          className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          id="items-search"
          type="search"
          placeholder="Search by title"
          defaultValue={defaultSearch}
          className="pl-9"
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <Select
        value={defaultStatus}
        onValueChange={(value) => update({ status: value === "all" ? "" : (value ?? "") })}
      >
        <SelectTrigger aria-label="Filter by status" className="w-full sm:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUS_OPTIONS.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
