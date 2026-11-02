import type { MetadataRoute } from "next";

import { APP_ENV } from "@repo/env/client";

import { siteUrl } from "@/lib/site-url";

// Only production is indexable — staging and preview deploys tell crawlers to
// stay out so they never compete with (or leak ahead of) the real site.
export default function robots(): MetadataRoute.Robots {
  if (APP_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
