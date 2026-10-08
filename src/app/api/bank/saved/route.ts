import { z } from "zod";

import { getRequestSession } from "@/server/auth/session";
import { savedAmong } from "@/server/repositories/saved-senses";

import { guarded, json, senseIdSchema, unauthenticated } from "./http";

/** At most this many senses per request: a page's worth, never the whole collection. */
const MAX_SENSES = 60;

const querySchema = z.array(senseIdSchema).min(1).max(MAX_SENSES);

/**
 * GET /api/bank/saved?senses=significant.notable,important.main
 *
 * Which of the listed senses the signed-in learner has saved. Public pages render the same for
 * everyone, so they ask for this in the browser; the learner comes only from the session cookie.
 */
export function GET(request: Request) {
  return guarded(async () => {
    const session = await getRequestSession(request);
    if (!session) return await unauthenticated();

    const raw = new URL(request.url).searchParams.get("senses") ?? "";
    const parsed = querySchema.safeParse([...new Set(raw.split(",").filter(Boolean))]);
    if (!parsed.success) return json({ error: "invalid_senses" }, 400);

    return json({ saved: await savedAmong(session.user.id, parsed.data) }, 200);
  });
}
