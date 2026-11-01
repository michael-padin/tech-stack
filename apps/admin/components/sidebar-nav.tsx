"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GaugeIcon, HelpCircleIcon, LayersIcon, UsersIcon } from "lucide-react";

import type { Capability } from "@repo/auth/permissions";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@repo/ui/components/sidebar";

// Data-driven navigation — add a resource by appending one entry. Each new
// admin section should have a matching route under app/(dashboard)/ gated by
// the same capability (hiding the link is convenience; the page is the gate).
const NAV: Array<{ href: string; label: string; icon: typeof GaugeIcon; capability?: Capability }> =
  [
    { href: "/", label: "Overview", icon: GaugeIcon, capability: "items.read" },
    { href: "/items", label: "Items", icon: LayersIcon, capability: "items.read" },
    { href: "/users", label: "Users", icon: UsersIcon, capability: "users.manage" },
    { href: "/help", label: "Help & docs", icon: HelpCircleIcon },
  ];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ capabilities }: { capabilities: readonly Capability[] }) {
  const pathname = usePathname() ?? "/";
  const visible = NAV.filter(
    (entry) => !entry.capability || capabilities.includes(entry.capability),
  );
  return (
    <SidebarMenu>
      {visible.map(({ href, label, icon: Icon }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton
            isActive={isActive(pathname, href)}
            tooltip={label}
            render={<Link href={href} />}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
