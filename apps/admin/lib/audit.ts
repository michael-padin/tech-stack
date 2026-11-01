import { headers } from "next/headers";

import { type RecordAuditInput, recordAudit } from "@repo/db/queries/audit";
import { logger } from "@repo/logger";

type Actor = { id: string; email: string };
type AuditEntry = Omit<RecordAuditInput, "actorId" | "actorEmail" | "ipAddress">;

// Append an audit-log entry for a mutation the actor just made. Call it after
// the mutation succeeds. A failed write is logged rather than thrown: the
// change already happened, and failing the action would only hide that.
export async function audit(actor: Actor, entry: AuditEntry): Promise<void> {
  const requestHeaders = await headers();
  const ipAddress =
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  try {
    await recordAudit({ ...entry, actorId: actor.id, actorEmail: actor.email, ipAddress });
  } catch (error) {
    logger.error({ err: error, action: entry.action }, "audit write failed");
  }
}
