import { APIError } from "better-auth/api";
import { z } from "zod";

import { Prisma } from "@repo/db/client";
import { logger } from "@repo/logger";

// Server Actions return this instead of throwing: in production Next replaces
// a thrown action error with a generic message, so the user would never see
// *why* a save failed. `redirect()` still throws — call it outside the try.
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export const actionOk: ActionResult = { ok: true, data: null };

/** A failure whose message is meant for the user (a rule the action enforces). */
export function actionFail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Turn a caught error into a message that is safe to show the user. */
export function actionError(
  error: unknown,
  fallback = "Something went wrong.",
): ActionResult<never> {
  if (error instanceof z.ZodError) {
    return actionFail(error.issues[0]?.message ?? "Invalid input.");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return actionFail("This record no longer exists.");
  }
  // Better Auth's own rules ("user already exists", "can't ban yourself").
  if (error instanceof APIError && error.message) {
    return actionFail(error.message);
  }
  logger.error({ err: error }, "server action failed");
  return actionFail(fallback);
}
