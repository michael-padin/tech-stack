import type { Item, ItemFilters, ItemInput, PageQuery, Paginated } from "@repo/types";

import { Prisma } from "../../generated/client";
import { prisma } from "../client";

// Selecting a stable column set keeps the serialized shape in one place.
const itemSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { name: true } },
} satisfies Prisma.ItemSelect;

type ItemRow = Prisma.ItemGetPayload<{ select: typeof itemSelect }>;

function serialize(row: ItemRow): Item {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    ownerId: row.ownerId,
    ownerName: row.owner?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(filters: Partial<ItemFilters>): Prisma.ItemWhereInput {
  return {
    deletedAt: null,
    ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {}),
    ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
  };
}

// `id` breaks ties so offset pages never repeat or skip rows that share a
// timestamp or title.
function buildOrderBy(filters: Partial<ItemFilters>): Prisma.ItemOrderByWithRelationInput[] {
  return filters.sort === "title"
    ? [{ title: "asc" }, { id: "asc" }]
    : [{ createdAt: "desc" }, { id: "desc" }];
}

/** Public/list reads — soft-deleted rows are always excluded. */
export async function listItems(filters: Partial<ItemFilters> = {}): Promise<Item[]> {
  const rows = await prisma.item.findMany({
    where: buildWhere(filters),
    orderBy: buildOrderBy(filters),
    select: itemSelect,
  });
  return rows.map(serialize);
}

/** Admin list reads — paginated. */
export async function listItemsPaginated(
  filters: Partial<ItemFilters>,
  page: PageQuery,
): Promise<Paginated<Item>> {
  const where = buildWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: buildOrderBy(filters),
      select: itemSelect,
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    }),
    prisma.item.count({ where }),
  ]);
  return {
    rows: rows.map(serialize),
    total,
    page: page.page,
    pageSize: page.pageSize,
    pageCount: Math.max(1, Math.ceil(total / page.pageSize)),
  };
}

export async function getItemById(id: string): Promise<Item | null> {
  const row = await prisma.item.findFirst({
    where: { id, deletedAt: null },
    select: itemSelect,
  });
  return row ? serialize(row) : null;
}

export async function createItem(input: ItemInput, ownerId?: string): Promise<{ id: string }> {
  const created = await prisma.item.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      ownerId: ownerId ?? null,
    },
    select: { id: true },
  });
  return created;
}

// `deletedAt: null` in the where makes a soft-deleted item behave as missing
// (Prisma throws P2025) instead of being silently edited or re-deleted.
export async function updateItem(id: string, input: ItemInput): Promise<void> {
  await prisma.item.update({
    where: { id, deletedAt: null },
    data: {
      title: input.title,
      description: input.description ?? null,
      status: input.status,
    },
  });
}

/** Soft delete — preserves the row for audit/restore. */
export async function softDeleteItem(id: string): Promise<void> {
  await prisma.item.update({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
