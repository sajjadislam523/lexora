import { isDue } from "@/learning/scheduler";
import { getRequestSession } from "@/server/auth/session";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { guarded, json, senseIdSchema, unauthenticated } from "@/server/http/responses";
import { isSameOrigin } from "@/server/http/same-origin";
import { reviewStateOf } from "@/server/repositories/review-cards";
import { removeSavedSense, saveSense } from "@/server/repositories/saved-senses";

/**
 * Save (PUT) or remove (DELETE) one sense in the signed-in learner's language bank.
 *
 * The learner comes only from the validated session cookie: the request carries no user ID and
 * any body is ignored, so one learner can never act for another. Cross-site requests are refused
 * (route handlers don't get Next's server-action CSRF protection). Only published senses of
 * published items can be newly saved; removing works for any sense, and both are idempotent.
 * Saves and removals together are limited to 60 a minute per learner (429 after that), counted
 * only once a request is authenticated and well formed. A save answers whether the meaning is
 * ready to review now (`review: "ready"`) or already scheduled for later (`"scheduled"`).
 */
type Context = RouteContext<"/api/bank/saved/[senseId]">;

type Authorised = { userId: string; senseId: string } | { response: Response };

async function authorise(request: Request, { params }: Context): Promise<Authorised> {
  if (!isSameOrigin(request)) return { response: json({ error: "forbidden" }, 403) };
  const session = await getRequestSession(request);
  if (!session) return { response: await unauthenticated() };
  const parsed = senseIdSchema.safeParse((await params).senseId);
  if (!parsed.success) return { response: json({ error: "invalid_sense" }, 400) };
  const limited = await enforceRateLimit(session.user.id, "bank_write");
  if (limited) return { response: limited };
  return { userId: session.user.id, senseId: parsed.data };
}

export function PUT(request: Request, context: Context) {
  return guarded(async () => {
    const auth = await authorise(request, context);
    if ("response" in auth) return auth.response;
    const outcome = await saveSense(auth.userId, auth.senseId);
    if (outcome === "not_found") return json({ error: "not_found" }, 404);
    // A new save is due at once (D3); saving one again leaves its schedule as it was.
    const state = await reviewStateOf(auth.userId, auth.senseId);
    const review = state && isDue(state.card, new Date()) ? "ready" : "scheduled";
    return json({ senseId: auth.senseId, saved: true, review }, 200);
  });
}

export function DELETE(request: Request, context: Context) {
  return guarded(async () => {
    const auth = await authorise(request, context);
    if ("response" in auth) return auth.response;
    await removeSavedSense(auth.userId, auth.senseId);
    return json({ senseId: auth.senseId, saved: false }, 200);
  });
}
