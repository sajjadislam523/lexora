import type { MetadataRoute } from "next";

import { PROTECTED_ROUTES } from "@/lib/auth-constants";
import { SITE_URL } from "@/server/site-url";

/** Public discovery pages are crawlable; personal learning areas and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PROTECTED_ROUTES, "/api/"] },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  };
}
