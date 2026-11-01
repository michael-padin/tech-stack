"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@repo/ui/components/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Overview",
  "/items": "Items",
  "/items/new": "New item",
  "/users": "Users",
  "/profile": "Profile",
  "/help": "Help & docs",
};

type Crumb = { href: string; label: string; current: boolean };

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ href: "/", label: "Overview", current: true }];
  }

  const crumbs: Crumb[] = [{ href: "/", label: "Overview", current: false }];

  let path = "";
  segments.forEach((seg, i) => {
    path += `/${seg}`;
    const isLast = i === segments.length - 1;
    let label = ROUTE_LABELS[path];
    if (!label) {
      const parent = segments[i - 1];
      if (parent === "items") label = "Edit item";
      else label = decodeURIComponent(seg);
    }
    crumbs.push({ href: path, label, current: isLast });
  });
  return crumbs;
}

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  const parent = crumbs.length >= 2 ? crumbs[crumbs.length - 2] : null;
  const current = crumbs[crumbs.length - 1];

  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5 md:hidden">
        {parent ? (
          <>
            <Link
              href={parent.href}
              aria-label={`Back to ${parent.label}`}
              className={`${buttonVariants({ variant: "ghost", size: "sm" })} -ml-2 h-8 gap-1`}
            >
              <ArrowLeftIcon size={14} aria-hidden="true" />
              <span className="text-xs">{parent.label}</span>
            </Link>
            <ChevronRightIcon
              size={12}
              aria-hidden="true"
              className="text-muted-foreground shrink-0"
            />
            <span className="text-foreground truncate text-sm font-medium">{current?.label}</span>
          </>
        ) : (
          <span className="text-foreground truncate text-sm font-medium">
            {current?.label ?? "Overview"}
          </span>
        )}
      </div>

      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          {crumbs.map((c, idx) => (
            <BreadcrumbFragment key={c.href} crumb={c} isLast={idx === crumbs.length - 1} />
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}

function BreadcrumbFragment({ crumb, isLast }: { crumb: Crumb; isLast: boolean }) {
  return (
    <>
      <BreadcrumbItem>
        {crumb.current ? (
          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
        )}
      </BreadcrumbItem>
      {isLast ? null : <BreadcrumbSeparator />}
    </>
  );
}
