import { after } from "next/server";

import { env } from "@/env";

// Must stay in sync with the tag constants in apps/web/lib/db.ts.
// `item:<id>` matches publicItemTag() over there.
export type WebRevalidateTag = "public-items" | `item:${string}`;

const REVALIDATE_TIMEOUT_MS = 5_000;

export function revalidateWeb(tags: WebRevalidateTag[]): void {
  const url = env.NEXT_PUBLIC_WEB_URL;
  const secret = env.REVALIDATE_SECRET;
  const isDev = env.NODE_ENV !== "production";

  if (tags.length === 0) return;

  if (!url || !secret) {
    if (isDev) {
      const missing = [!url && "NEXT_PUBLIC_WEB_URL", !secret && "REVALIDATE_SECRET"]
        .filter(Boolean)
        .join(", ");
      console.warn(
        `[revalidateWeb] skipped — missing env: ${missing}. Public cache will not refresh.`,
      );
    }
    return;
  }

  const endpoint = `${url.replace(/\/$/, "")}/api/revalidate`;

  after(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REVALIDATE_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "<unreadable>");
        console.error(
          `[revalidateWeb] ${endpoint} responded ${res.status} ${res.statusText}: ${body}`,
        );
      }
    } catch (err) {
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? `timed out after ${REVALIDATE_TIMEOUT_MS}ms`
          : err;
      console.error(`[revalidateWeb] ${endpoint} failed:`, reason);
    } finally {
      clearTimeout(timer);
    }
  });
}
