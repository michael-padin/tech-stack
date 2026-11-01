import { cookies } from "next/headers";

import { requireSession } from "@repo/auth/next";
import { capabilitiesFor } from "@repo/auth/permissions";
import { ROLE_LABELS } from "@repo/types";

import { AdminShell } from "@/components/admin-shell";

// Every signed-in, non-banned role gets the shell; each page gates its own
// resource with requireCapability, and the nav only lists what the role can open.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const cookieStore = await cookies();
  const capabilities = capabilitiesFor(session.user);

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: capabilities.role ? ROLE_LABELS[capabilities.role] : "no role",
  };
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AdminShell user={user} capabilities={capabilities.list} defaultOpen={defaultOpen}>
      {children}
    </AdminShell>
  );
}
