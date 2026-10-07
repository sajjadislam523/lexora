import type { MetadataRoute } from "next";

import { languageContent } from "@/language";
import { SITE_URL } from "@/server/site-url";

// Rebuilt at most hourly, like the language pages it lists.
export const revalidate = 3600;

/** The public discovery layer: landing page, Explore, and every published language page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await languageContent.listPublishedSlugs();
  return [
    { url: new URL("/", SITE_URL).href, changeFrequency: "weekly", priority: 1 },
    { url: new URL("/explore", SITE_URL).href, changeFrequency: "weekly", priority: 0.8 },
    ...slugs.map((slug) => ({
      url: new URL(`/language/${slug}`, SITE_URL).href,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
