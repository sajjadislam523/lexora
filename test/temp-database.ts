import { randomUUID } from "node:crypto";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { connect, type Database } from "@/server/db/connect";

/**
 * A throwaway PostgreSQL database with every migration applied, for tests that import content
 * (which works on the whole content set and so can't share the development database).
 * Created next to DATABASE_URL's database and dropped afterwards.
 */
export async function createTempDatabase(): Promise<{ db: Database; drop: () => Promise<void> }> {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");

  const name = `lexora_it_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const admin = postgres(base, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database "${name}"`);

  const url = new URL(base);
  url.pathname = `/${name}`;
  const db = connect(url.toString(), { max: 2 });
  await migrate(db, { migrationsFolder: "drizzle" });

  return {
    db,
    drop: async () => {
      await db.$client.end();
      await admin.unsafe(`drop database if exists "${name}" with (force)`);
      await admin.end();
    },
  };
}
