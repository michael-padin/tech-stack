import Link from "next/link";

import { APP_NAME } from "@repo/env/client";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";
import { Separator } from "@repo/ui/components/separator";

import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { BrandMark } from "@/components/brand-mark";
import { ModeToggle } from "@/components/mode-toggle";
import { PublicSiteLink } from "@/components/public-site-link";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import type { Capability } from "@repo/auth/permissions";

type AdminShellProps = {
  children: React.ReactNode;
  user: { name: string; email: string; role: string };
  /** What the signed-in role may do — drives which nav entries show. */
  capabilities: readonly Capability[];
  defaultOpen: boolean;
};

export function AdminShell({ children, user, capabilities, defaultOpen }: AdminShellProps) {
  const initials =
    user.name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "??";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
            <BrandMark className="text-primary size-4 shrink-0" />
            <span className="truncate text-xs font-semibold tracking-[0.16em] uppercase group-data-[collapsible=icon]:hidden">
              {APP_NAME}
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarNav capabilities={capabilities} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2 px-1">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="text-foreground truncate text-sm font-semibold">{user.name}</p>
              <p className="text-muted-foreground truncate text-xs">{user.email}</p>
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <UserMenu role={user.role} />
            </div>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="bg-background sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 hidden h-5 md:block" />
          <AdminBreadcrumbs />
          <div className="ml-auto flex items-center gap-1">
            <PublicSiteLink />
            <ModeToggle />
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
