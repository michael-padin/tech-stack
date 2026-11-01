import type { AppRole } from "@repo/types";

import { prisma } from "../client";

// Reads the user-management guards need. Mutations stay with Better Auth's
// admin API (it owns sessions, bans and password hashing).

export async function getUserRole(id: string): Promise<AppRole | null> {
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return user?.role ?? null;
}

/** Admins who can still sign in — the count "don't remove the last admin" protects. */
export async function countActiveAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "admin", banned: false } });
}
