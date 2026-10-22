import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { ALLOW_REMOTE_DB, guardDatabaseTarget } from "./scripts/database-target";

// Read the remote override from the shell before any env file can supply it.
const allowRemote = process.env[ALLOW_REMOTE_DB];

// Load .env.local / .env exactly as Next.js does.
loadEnvConfig(process.cwd());

// Migrations need a direct (non-pooled) connection on Neon.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
// Local databases only, unless the shell names the remote host (scripts/database-target.ts).
guardDatabaseTarget(url, "drizzle-kit (migrations)", allowRemote);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
