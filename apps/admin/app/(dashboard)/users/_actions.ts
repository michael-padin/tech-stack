"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@repo/auth/server";
import { requireCapability } from "@repo/auth/next";
import { countActiveAdmins, getUserRole } from "@repo/db/queries/users";
import { appRoleSchema } from "@repo/types";

import { type ActionResult, actionError, actionFail, actionOk } from "@/lib/action-result";
import { audit } from "@/lib/audit";

const inviteSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().trim().min(1, "Name required"),
  role: appRoleSchema,
});
const userIdSchema = z.string().min(1).max(255);
const banReasonSchema = z.string().trim().max(500, "Reason is too long.");

// Every user-management action is admin-only (`users.manage`).
async function requireUserManager() {
  return requireCapability("users.manage");
}

// Ban/remove guards: never act on yourself, and never take away the last
// admin who can still sign in — either would lock everyone out.
async function guardTarget(actorId: string, targetId: string): Promise<string | null> {
  if (targetId === actorId) return "You can't do that to your own account.";
  if ((await getUserRole(targetId)) === "admin" && (await countActiveAdmins()) <= 1) {
    return "This is the last active admin. Promote someone else first.";
  }
  return null;
}

export async function inviteUserAction(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult<{ tempPassword: string }>> {
  const session = await requireUserManager();
  try {
    const parsed = inviteSchema.parse(input);
    // Generate a temp password the inviter can share manually. We don't send
    // email yet — the admin copies the credentials and hands them to the new
    // teammate, who can then change their password after first sign-in.
    const tempPassword = generateTempPassword();
    const created = await auth.api.createUser({
      body: { email: parsed.email, name: parsed.name, password: tempPassword, role: parsed.role },
      headers: await headers(),
    });
    await audit(session.user, {
      action: "user.invite",
      entity: "user",
      entityId: created.user.id,
      summary: `Invited ${parsed.email} as ${parsed.role}`,
      after: { email: parsed.email, name: parsed.name, role: parsed.role },
    });
    revalidatePath("/users");
    return { ok: true, data: { tempPassword } };
  } catch (error) {
    return actionError(error, "Couldn't create the account.");
  }
}

export async function banUserAction(userId: string, reason: string): Promise<ActionResult> {
  const session = await requireUserManager();
  try {
    const id = userIdSchema.parse(userId);
    const banReason = banReasonSchema.parse(reason);
    const blocked = await guardTarget(session.user.id, id);
    if (blocked) return actionFail(blocked);
    const reqHeaders = await headers();
    await auth.api.banUser({ body: { userId: id, banReason }, headers: reqHeaders });
    // banUser flips the flag but leaves existing sessions valid until cookie
    // expiry. Revoke them so the ban takes effect immediately.
    await auth.api.revokeUserSessions({ body: { userId: id }, headers: reqHeaders });
    await audit(session.user, {
      action: "user.ban",
      entity: "user",
      entityId: id,
      summary: banReason ? `Banned: ${banReason}` : "Banned",
    });
  } catch (error) {
    return actionError(error, "Couldn't ban the user.");
  }
  revalidatePath("/users");
  return actionOk;
}

export async function unbanUserAction(userId: string): Promise<ActionResult> {
  const session = await requireUserManager();
  try {
    const id = userIdSchema.parse(userId);
    await auth.api.unbanUser({ body: { userId: id }, headers: await headers() });
    await audit(session.user, { action: "user.unban", entity: "user", entityId: id });
  } catch (error) {
    return actionError(error, "Couldn't unban the user.");
  }
  revalidatePath("/users");
  return actionOk;
}

export async function removeUserAction(userId: string): Promise<ActionResult> {
  const session = await requireUserManager();
  try {
    const id = userIdSchema.parse(userId);
    const blocked = await guardTarget(session.user.id, id);
    if (blocked) return actionFail(blocked);
    const reqHeaders = await headers();
    // Revoke before delete: if removeUser succeeds but revoke fails afterward,
    // the now-deleted user still holds a usable cookie until expiry.
    await auth.api.revokeUserSessions({ body: { userId: id }, headers: reqHeaders });
    await auth.api.removeUser({ body: { userId: id }, headers: reqHeaders });
    await audit(session.user, { action: "user.remove", entity: "user", entityId: id });
  } catch (error) {
    return actionError(error, "Couldn't remove the account.");
  }
  revalidatePath("/users");
  return actionOk;
}

// Reset another user's password. Generates a fresh temp password the caller
// can share manually (same flow as invite), then revokes the target's active
// sessions so they're forced to sign in again with the new credentials.
// `setUserPassword` alone does NOT revoke sessions, which would let a stale
// session keep running with the old token after the change.
export async function resetUserPasswordAction(
  userId: string,
): Promise<ActionResult<{ tempPassword: string }>> {
  const session = await requireUserManager();
  try {
    const id = userIdSchema.parse(userId);
    const tempPassword = generateTempPassword();
    const reqHeaders = await headers();
    await auth.api.setUserPassword({
      body: { userId: id, newPassword: tempPassword },
      headers: reqHeaders,
    });
    await auth.api.revokeUserSessions({ body: { userId: id }, headers: reqHeaders });
    await audit(session.user, { action: "user.reset_password", entity: "user", entityId: id });
    revalidatePath("/users");
    return { ok: true, data: { tempPassword } };
  } catch (error) {
    return actionError(error, "Couldn't reset the password.");
  }
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
