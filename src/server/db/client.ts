import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/server/env";

import * as schema from "./schema";

/**
 * The single database client. Server-only: never import from client components.
 * Neon's pooled endpoints (PgBouncer in transaction mode) need prepared statements off.
 */
function createClient() {
  const url = serverEnv().DATABASE_URL;
  const pooled = new URL(url).hostname.includes("-pooler");
  const sql = postgres(url, {
    prepare: !pooled,
    // Serverless instances should hold few connections; the pooler multiplexes them.
    max: process.env.VERCEL ? 5 : 10,
  });
  return drizzle(sql, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createClient>;

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { lexoraDb?: Database };

export const db: Database = globalForDb.lexoraDb ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.lexoraDb = db;
