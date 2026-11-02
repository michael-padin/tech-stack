import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { format } from "date-fns";

import { APP_NAME } from "@repo/env/client";
import { STATUS_DESCRIPTIONS } from "@repo/types";
import { Separator } from "@repo/ui/components/separator";

import { StatusBadge } from "@/components/status-badge";
import { fetchItemById } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = await fetchItemById(id);
  if (!item) return { title: APP_NAME };
  const description = item.description ?? `${item.title} on ${APP_NAME}.`;
  return {
    title: item.title,
    description,
    alternates: { canonical: `/items/${item.id}` },
    openGraph: { type: "article", title: item.title, description },
  };
}

export default async function ItemPage({ params }: PageProps) {
  const { id } = await params;
  const item = await fetchItemById(id);
  if (!item) notFound();

  return (
    <main className="bg-background min-h-svh">
      <header className="border-border/60 border-b px-6 py-3 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl items-center">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-[0.68rem] tracking-[0.22em] uppercase transition-colors"
          >
            <ArrowLeftIcon size={14} aria-hidden="true" />
            Back to items
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-8 sm:py-14">
        <div className="flex items-start justify-between gap-4">
          <h1 className="display text-3xl leading-tight sm:text-4xl">{item.title}</h1>
          <StatusBadge status={item.status} className="mt-1.5" />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">{STATUS_DESCRIPTIONS[item.status]}</p>

        <Separator className="my-8" />

        {item.description ? (
          <p className="max-w-prose text-base leading-relaxed">{item.description}</p>
        ) : (
          <p className="text-muted-foreground text-base italic">No description.</p>
        )}

        <dl className="text-muted-foreground mt-10 grid grid-cols-1 gap-4 font-mono text-xs tabular-nums sm:grid-cols-2">
          <div>
            <dt className="tracking-[0.18em] uppercase">Created</dt>
            <dd className="text-foreground mt-1">
              {format(new Date(item.createdAt), "MMM d, yyyy")}
            </dd>
          </div>
          <div>
            <dt className="tracking-[0.18em] uppercase">Updated</dt>
            <dd className="text-foreground mt-1">
              {format(new Date(item.updatedAt), "MMM d, yyyy")}
            </dd>
          </div>
          {item.ownerName ? (
            <div>
              <dt className="tracking-[0.18em] uppercase">Owner</dt>
              <dd className="text-foreground mt-1 font-sans">{item.ownerName}</dd>
            </div>
          ) : null}
        </dl>
      </article>
    </main>
  );
}
