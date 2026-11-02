import { createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";

import { recordAudit } from "@repo/db/queries/audit";

// Audits every write on Better Auth's admin API — the /users Server Actions
// and anyone calling /api/auth/admin/* directly go through here alike, so no
// role change, ban or impersonation escapes the log. Reads are skipped.
const AUDITED: Record<string, string> = {
  "/admin/create-user": "user.create",
  "/admin/update-user": "user.update",
  "/admin/set-role": "user.set_role",
  "/admin/ban-user": "user.ban",
  "/admin/unban-user": "user.unban",
  "/admin/remove-user": "user.remove",
  "/admin/set-user-password": "user.set_password",
  "/admin/revoke-user-session": "user.revoke_session",
  "/admin/revoke-user-sessions": "user.revoke_sessions",
  "/admin/impersonate-user": "user.impersonate",
  "/admin/stop-impersonating": "user.stop_impersonating",
};

type Body = { userId?: string; email?: string; role?: string | string[]; banReason?: string };

export const auditAdminActions = createAuthMiddleware(async (ctx) => {
  const action = AUDITED[ctx.path];
  if (!action) return;
  const returned = ctx.context.returned;
  if (isAPIError(returned)) return; // the call failed — nothing changed

  // Only non-secret fields: never the password from create/set-user-password.
  const body = (ctx.body ?? {}) as Body;
  const createdId = (returned as { user?: { id?: string } } | undefined)?.user?.id;
  const session = await getSessionFromCtx(ctx).catch(() => null);
  const headers = ctx.headers ?? ctx.request?.headers;

  try {
    await recordAudit({
      action,
      entity: "user",
      entityId: body.userId ?? createdId ?? null,
      actorId: session?.user.id ?? null,
      actorEmail: session?.user.email ?? null,
      summary: body.email ?? null,
      metadata: {
        ...(body.role ? { role: body.role } : {}),
        ...(body.banReason ? { banReason: body.banReason } : {}),
      },
      ipAddress:
        headers?.get("x-real-ip") ?? headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
  } catch (error) {
    // The change already happened; a failed audit write must not undo the response.
    console.error("audit write failed", action, error);
  }
});
