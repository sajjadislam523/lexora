import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Opens a Drizzle client on a PostgreSQL URL. The app uses the shared client in `./client`;
 * the content CLI and tests open their own connections through this, without side effects.
 * Neon's pooled endpoints (PgBouncer in transaction mode) need prepared statements off.
 */
export function connect(url: string, options: { max?: number } = {}) {
  const pooled = new URL(url).hostname.includes("-pooler");
  const sql = postgres(url, {
    prepare: !pooled,
    // Serverless instances should hold few connections; the pooler multiplexes them.
    max: options.max ?? (process.env.VERCEL ? 5 : 10),
  });
  return drizzle(sql, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof connect>;
