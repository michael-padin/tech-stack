"use client";

import { useRouter } from "next/navigation";

import type { Item } from "@repo/types";

import { Card } from "@repo/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

import { StatusPill } from "@/components/status-pill";

import { ItemRowActions } from "./item-row-actions";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  if (diff < 0) return "just now";
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return iso.slice(0, 10);
}

export function ItemsTable({ items, canDelete }: { items: Item[]; canDelete: boolean }) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="hidden w-40 md:table-cell">Owner</TableHead>
              <TableHead className="hidden w-40 md:table-cell">Updated</TableHead>
              <TableHead className="w-16">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => router.push(`/items/${item.id}`)}
              >
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>
                  <StatusPill status={item.status} />
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                  {item.ownerName ?? "—"}
                </TableCell>
                <TableCell
                  className={cn("text-muted-foreground hidden text-xs tabular-nums md:table-cell")}
                >
                  {relativeTime(item.updatedAt)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <ItemRowActions itemId={item.id} itemTitle={item.title} canDelete={canDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
