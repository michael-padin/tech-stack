import { z } from "zod";

import { Prisma } from "@repo/db/client";
import { logger } from "@repo/logger";

// Server Actions return this instead of throwing: in production Next replaces
// a thrown action error with a generic message, so the user would never see
// *why* a save failed. `redirect()` still throws — call it outside the try.
export type ActionResult = { ok: true } | { ok: false; error: string };

export const actionOk: ActionResult = { ok: true };

/** Turn a caught error into a message that is safe to show the user. */
export function actionError(error: unknown, fallback = "Something went wrong."): ActionResult {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Invalid input." };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return { ok: false, error: "This record no longer exists." };
  }
  logger.error({ err: error }, "server action failed");
  return { ok: false, error: fallback };
}
