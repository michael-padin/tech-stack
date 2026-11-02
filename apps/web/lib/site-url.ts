import { env } from "@/env";

/** Absolute origin of the public site, for metadata, the sitemap and robots.txt. */
export function siteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";
}
