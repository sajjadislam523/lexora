import "server-only";

/**
 * The public origin of the app, for canonical URLs, the sitemap and robots.txt. It is the same
 * origin Better Auth runs on (BETTER_AUTH_URL, required in production).
 */
export const SITE_URL = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
