import type { MetadataRoute } from "next";

import { languageRepository } from "@/language";
import { SITE_URL } from "@/server/site-url";

/** The public discovery layer: landing page, Explore, and every language page. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: new URL("/", SITE_URL).href, changeFrequency: "weekly", priority: 1 },
    { url: new URL("/explore", SITE_URL).href, changeFrequency: "weekly", priority: 0.8 },
    ...languageRepository.listItems().map((item) => ({
      url: new URL(`/language/${item.slug}`, SITE_URL).href,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
