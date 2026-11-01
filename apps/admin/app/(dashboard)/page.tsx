import { cache, Suspense } from "react";
import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "lucide-react";

import { requireCapability } from "@repo/auth/next";
import { hasPermission } from "@repo/auth/permissions";
import { STATUS_DESCRIPTIONS, STATUS_LABELS, type ItemStatus } from "@repo/types";

import { buttonVariants } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Separator } from "@repo/ui/components/separator";
import { Skeleton } from "@repo/ui/components/skeleton";

import { StatusPill } from "@/components/status-pill";
import { getCachedAdminSummary } from "@/lib/cached-data";

// Status order shown across the overview cards.
const STATUSES: ItemStatus[] = ["active", "draft", "archived"];
const CARD_KEYS = ["c-1", "c-2", "c-3"] as const;

// Dedupe within a single request render — headline + cards share one query.
const getSummary = cache(() => getCachedAdminSummary());

export default async function AdminHome() {
  const session = await requireCapability("items.read");
  const canCreate = hasPermission(session.user, "items.create");

  return (
    <>
      <header className="border-border/60 border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-8 sm:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-tight font-semibold">Overview</h1>
            <Suspense fallback={<Skeleton className="mt-2 h-4 w-72" />}>
              <SummaryHeadline />
            </Suspense>
          </div>
          {canCreate ? (
            <Link href="/items/new" className={buttonVariants({ size: "sm" })}>
              <PlusIcon aria-hidden="true" /> New item
            </Link>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10 sm:px-8">
        <Suspense fallback={<CardsSkeleton />}>
          <SummaryCards />
        </Suspense>

        <Separator />

        <section>
          <h2 className="text-foreground text-sm font-semibold">What each status means</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {STATUSES.map((status) => (
              <div key={status} className="flex items-start gap-3">
                <StatusPill status={status} />
                <p className="text-muted-foreground text-sm">{STATUS_DESCRIPTIONS[status]}</p>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}

async function SummaryHeadline() {
  const { total } = await getSummary();
  return (
    <p className="text-muted-foreground mt-2 max-w-prose text-sm">
      {total} item{total === 1 ? "" : "s"} in the catalog.
    </p>
  );
}

async function SummaryCards() {
  const { total, byStatus } = await getSummary();
  return (
    <section>
      <h2 className="text-foreground text-sm font-semibold">At a glance</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TotalCard total={total} />
        {STATUSES.map((status) => (
          <StatusCard key={status} status={status} count={byStatus[status]} />
        ))}
      </div>
    </section>
  );
}

function TotalCard({ total }: { total: number }) {
  return (
    <Link href="/items" className="group">
      <Card className="hover:border-primary/40 h-full gap-2 p-5 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">All items</span>
          <ArrowRightIcon
            size={14}
            aria-hidden="true"
            className="text-muted-foreground/50 group-hover:text-foreground transition-colors"
          />
        </div>
        <p className="text-3xl font-semibold tabular-nums">{total}</p>
      </Card>
    </Link>
  );
}

function StatusCard({ status, count }: { status: ItemStatus; count: number }) {
  return (
    <Link href={`/items?status=${status}`} className="group">
      <Card className="hover:border-primary/40 h-full gap-2 p-5 transition-colors">
        <div className="flex items-center justify-between">
          <StatusPill status={status} />
          <ArrowRightIcon
            size={14}
            aria-hidden="true"
            className="text-muted-foreground/50 group-hover:text-foreground transition-colors"
          />
        </div>
        <p className="text-3xl font-semibold tabular-nums">{count}</p>
        <p className="text-muted-foreground text-xs">{STATUS_LABELS[status]}</p>
      </Card>
    </Link>
  );
}

function CardsSkeleton() {
  return (
    <section>
      <Skeleton className="h-4 w-24" />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28 rounded-xl" />
        {CARD_KEYS.map((key) => (
          <Skeleton key={key} className="h-28 rounded-xl" />
        ))}
      </div>
    </section>
  );
}
