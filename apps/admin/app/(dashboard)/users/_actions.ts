"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@repo/auth/server";
import { requireAdmin } from "@repo/auth/next";
import { appRoleSchema } from "@repo/types";

const inviteSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().trim().min(1, "Name required"),
  role: appRoleSchema,
});

export async function inviteUserAction(input: z.input<typeof inviteSchema>) {
  await requireAdmin();
  const parsed = inviteSchema.parse(input);
  // Generate a temp password the inviter can share manually. We don't send
  // email yet — the admin copies the credentials and hands them to the new
  // teammate, who can then change their password after first sign-in.
  const tempPassword = generateTempPassword();
  await auth.api.createUser({
    body: {
      email: parsed.email,
      name: parsed.name,
      password: tempPassword,
      role: parsed.role,
    },
    headers: await headers(),
  });
  revalidatePath("/users");
  return { tempPassword };
}

export async function banUserAction(userId: string, reason: string) {
  await requireAdmin();
  const reqHeaders = await headers();
  await auth.api.banUser({
    body: { userId, banReason: reason },
    headers: reqHeaders,
  });
  // banUser flips the flag but leaves existing sessions valid until cookie
  // expiry. Revoke them so the ban takes effect immediately.
  await auth.api.revokeUserSessions({
    body: { userId },
    headers: reqHeaders,
  });
  revalidatePath("/users");
}

export async function unbanUserAction(userId: string) {
  await requireAdmin();
  await auth.api.unbanUser({
    body: { userId },
    headers: await headers(),
  });
  revalidatePath("/users");
}

export async function removeUserAction(userId: string) {
  await requireAdmin();
  const reqHeaders = await headers();
  // Revoke before delete: if removeUser succeeds but revoke fails afterward,
  // the now-deleted user still holds a usable cookie until expiry.
  await auth.api.revokeUserSessions({
    body: { userId },
    headers: reqHeaders,
  });
  await auth.api.removeUser({
    body: { userId },
    headers: reqHeaders,
  });
  revalidatePath("/users");
}

// Reset another admin's password. Generates a fresh temp password the
// caller can share manually (same flow as invite), then revokes the
// target's active sessions so they're forced to sign in again with the
// new credentials. `setUserPassword` alone does NOT revoke sessions,
// which would let a stale session keep running with the old token even
// after the password change — we explicitly close that gap here.
export async function resetUserPasswordAction(userId: string) {
  await requireAdmin();
  const tempPassword = generateTempPassword();
  const reqHeaders = await headers();
  await auth.api.setUserPassword({
    body: { userId, newPassword: tempPassword },
    headers: reqHeaders,
  });
  await auth.api.revokeUserSessions({
    body: { userId },
    headers: reqHeaders,
  });
  revalidatePath("/users");
  return { tempPassword };
}

function generateTempPassword(): string {
  // 16 chars, mixed alphanum, easy to read aloud (no 0/O/1/l confusion).
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
