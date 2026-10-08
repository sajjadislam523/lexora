import { getRequestSession } from "@/server/auth/session";
import { isSameOrigin } from "@/server/http/same-origin";
import { removeSavedSense, saveSense } from "@/server/repositories/saved-senses";

import { guarded, json, senseIdSchema, unauthenticated } from "../http";

/**
 * Save (PUT) or remove (DELETE) one sense in the signed-in learner's language bank.
 *
 * The learner comes only from the validated session cookie: the request carries no user ID and
 * any body is ignored, so one learner can never act for another. Cross-site requests are refused
 * (route handlers don't get Next's server-action CSRF protection). Only published senses of
 * published items can be newly saved; removing works for any sense, and both are idempotent.
 */
type Context = RouteContext<"/api/bank/saved/[senseId]">;

type Authorised = { userId: string; senseId: string } | { response: Response };

async function authorise(request: Request, { params }: Context): Promise<Authorised> {
  if (!isSameOrigin(request)) return { response: json({ error: "forbidden" }, 403) };
  const session = await getRequestSession(request);
  if (!session) return { response: await unauthenticated() };
  const parsed = senseIdSchema.safeParse((await params).senseId);
  if (!parsed.success) return { response: json({ error: "invalid_sense" }, 400) };
  return { userId: session.user.id, senseId: parsed.data };
}

export function PUT(request: Request, context: Context) {
  return guarded(async () => {
    const auth = await authorise(request, context);
    if ("response" in auth) return auth.response;
    const outcome = await saveSense(auth.userId, auth.senseId);
    if (outcome === "not_found") return json({ error: "not_found" }, 404);
    return json({ senseId: auth.senseId, saved: true }, 200);
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
