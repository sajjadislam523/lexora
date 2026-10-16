import "server-only";

import { LOCAL_APP_URL, resolveAppUrls } from "./app-url";

/**
 * The public origin of the app, for canonical URLs, the sitemap and robots.txt. It is the same
 * URL Better Auth runs on: BETTER_AUTH_URL in Production and locally, and Vercel's own address
 * for the deployment on Preview (see `app-url.ts`).
 */
const { VERCEL_ENV, VERCEL_URL, VERCEL_BRANCH_URL, BETTER_AUTH_URL } = process.env;

export const SITE_URL = new URL(
  resolveAppUrls({ VERCEL_ENV, VERCEL_URL, VERCEL_BRANCH_URL, BETTER_AUTH_URL })?.url ??
    LOCAL_APP_URL,
);
