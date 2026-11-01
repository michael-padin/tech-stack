"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@repo/auth/server";
import { requireSession } from "@repo/auth/next";

/**
 * Revoke one of the current user's own sessions by token. Used from the
 * Active Sessions card on /profile so the user can sign out a specific
 * device without touching any others.
 */
export async function revokeMySessionAction(token: string): Promise<void> {
  await requireSession();
  await auth.api.revokeSession({
    body: { token },
    headers: await headers(),
  });
  revalidatePath("/profile");
}
