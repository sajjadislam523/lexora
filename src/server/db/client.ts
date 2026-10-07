import "server-only";

import { serverEnv } from "@/server/env";

import { connect, type Database } from "./connect";

export type { Database };

/** The app's single database client. Server-only: never import from client components. */
function createClient() {
  return connect(serverEnv().DATABASE_URL);
}

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { lexoraDb?: Database };

export const db: Database = globalForDb.lexoraDb ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.lexoraDb = db;
