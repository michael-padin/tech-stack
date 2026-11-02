import type { MetadataRoute } from "next";

import { fetchItems } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";

// Public pages plus every active item (fetchItems already hides drafts and
// archived items, and is cached under the public-items tag).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const items = await fetchItems();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/help`, changeFrequency: "monthly", priority: 0.3 },
    ...items.map((item) => ({ url: `${base}/items/${item.id}`, lastModified: item.updatedAt })),
  ];
}
