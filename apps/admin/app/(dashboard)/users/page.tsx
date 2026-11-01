import { Suspense } from "react";
import { ShieldIcon } from "lucide-react";

import { auth } from "@repo/auth/server";
import { requireCapability } from "@repo/auth/next";

import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { headers } from "next/headers";

import { ListPagination } from "@/components/list-pagination";
import { resolvePageSize } from "@/components/pagination-helpers";

import { InviteDialog } from "./_components/invite-dialog";
import { UserRowActions } from "./_components/user-row-actions";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per_page?: string }>;
}) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = resolvePageSize(params.per_page);

  return (
    <>
      <header className="border-border/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg leading-tight font-semibold sm:text-xl">
              Admins &amp; teammates
            </h1>
            <p className="text-muted-foreground mt-0.5 max-w-prose text-xs sm:text-sm">
              Invite advisers or co-maintainers. New accounts skip public sign-up — you hand them
              their temporary password directly.
            </p>
          </div>
          <InviteDialog />
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <Suspense key={`${safePage}-${pageSize}`} fallback={<UsersTableSkeleton />}>
          <UsersBody safePage={safePage} pageSize={pageSize} />
        </Suspense>
      </div>
    </>
  );
}

async function UsersBody({ safePage, pageSize }: { safePage: number; pageSize: number }) {
  const session = await requireCapability("users.manage");
  const result = await auth.api.listUsers({
    query: {
      limit: pageSize,
      offset: (safePage - 1) * pageSize,
    },
    headers: await headers(),
  });
  const users = (result?.users ?? []) as Array<{
    id: string;
    email: string;
    name: string;
    banned: boolean;
    banReason: string | null;
    createdAt: string | Date;
  }>;
  const total = (result as { total?: number } | undefined)?.total ?? users.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(safePage, pageCount);

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-40">Joined</TableHead>
                <TableHead className="w-20">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="bg-primary/15 text-primary grid size-8 place-items-center rounded-full"
                      >
                        <ShieldIcon size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{u.name}</p>
                        <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.banned ? (
                      <Badge variant="destructive">Banned</Badge>
                    ) : (
                      <Badge className="bg-status-success-soft text-status-success border-status-success/30">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {u.id !== session.user.id ? (
                      <UserRowActions userId={u.id} userEmail={u.email} banned={u.banned} />
                    ) : (
                      <span className="text-muted-foreground text-xs">you</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <ListPagination
        page={page}
        pageCount={pageCount}
        basePath="/users"
        baseQuery={{}}
        totalCount={total}
        pageSize={pageSize}
      />
    </>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="border-border/60 overflow-hidden rounded-lg border">
      {["r1", "r2", "r3", "r4", "r5"].map((key) => (
        <div
          key={key}
          className="border-border/60 flex items-center gap-3 border-b px-4 py-3 last:border-0"
        >
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
