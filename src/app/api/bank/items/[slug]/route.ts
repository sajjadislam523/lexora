import { NextResponse } from "next/server";

import { languageContent } from "@/language";
import { getRequestSession } from "@/server/auth/session";
import { isSameOrigin } from "@/server/http/same-origin";

/**
 * Save (PUT) or remove (DELETE) a language item in the signed-in learner's language bank.
 *
 * The account is taken only from the validated session cookie. The request carries no user ID,
 * and any body is ignored, so one learner can never act for another.
 * Until the language bank is built (Phase 5) nothing is stored: the response says so with
 * `stored: false`, and the client keeps the state for this browser session.
 */
function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function setSaved(
  request: Request,
  { params }: RouteContext<"/api/bank/items/[slug]">,
  saved: boolean,
) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  const session = await getRequestSession(request);
  if (!session) return json({ error: "unauthenticated" }, 401);

  // Only published language can be saved; old or retired slugs aren't saveable addresses.
  const { slug } = await params;
  const item = await languageContent.getItemBySlug(slug);
  if (!item || "redirectTo" in item) return json({ error: "not_found" }, 404);

  return json({ slug: item.slug, saved, stored: false }, 200);
}

export function PUT(request: Request, context: RouteContext<"/api/bank/items/[slug]">) {
  return setSaved(request, context, true);
}

export function DELETE(request: Request, context: RouteContext<"/api/bank/items/[slug]">) {
  return setSaved(request, context, false);
}
