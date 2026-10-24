import "server-only";

import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { SENSE_ID_PATTERN } from "@/language/schema/content";
import { db } from "@/server/db/client";

/** A sense ID as authored: `significant.notable`. Anything else is rejected before any query. */
export const senseIdSchema = z.string().max(160).regex(SENSE_ID_PATTERN);

export function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * The answer when there's no session. Better Auth reports a database outage as "no session", and
 * a 401 sends the browser to the save gate ("create an account") — wrong for a signed-in learner
 * during an outage. So confirm the database is reachable first; if it isn't, this throws and
 * `guarded` answers 503.
 */
export async function unauthenticated() {
  await db.execute(sql`select 1`);
  return json({ error: "unauthenticated" }, 401);
}

/**
 * Runs a handler; a failure (such as the database being down) is a generic 503, never details.
 * The log names the request and the error class only: never a message that could hold input.
 */
export async function guarded(handler: () => Promise<Response>, label = "Saved language request") {
  try {
    return await handler();
  } catch (error) {
    console.error(`${label} failed`, error instanceof Error ? error.name : "error");
    return json({ error: "unavailable" }, 503);
  }
}
