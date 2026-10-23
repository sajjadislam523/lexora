import { getRequestSession } from "@/server/auth/session";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { guarded, json, unauthenticated } from "@/server/http/responses";
import { isSameOrigin } from "@/server/http/same-origin";
import { answerRequestSchema, answerReview } from "@/server/learning/review";

/** A request body is a few short fields; anything larger isn't an answer. */
const MAX_BODY_BYTES = 2048;

const CONFLICTS = new Set(["retired", "stale", "not_due", "exercise_changed"]);

/**
 * POST /api/review/answers — answer one review exercise (Phase 5 specification §15, D21).
 *
 * Same origin, then the session, then the learner's limit (30 a minute), then the body. The body
 * names only the sense, the exercise, the review number it was shown at and the answer: the
 * learner comes from the session, and correctness, due state and the next box are decided here
 * from authored content and the locked card. A retry of a recorded answer returns the stored
 * result (`duplicate: true`) and changes nothing.
 */
export function POST(request: Request) {
  return guarded(async () => {
    if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);
    const session = await getRequestSession(request);
    if (!session) return unauthenticated();
    const limited = await enforceRateLimit(session.user.id, "review_answer");
    if (limited) return limited;

    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return json({ error: "invalid_request" }, 400);
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "invalid_request" }, 400);
    }
    const parsed = answerRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_request" }, 400);

    const result = await answerReview(session.user.id, parsed.data, new Date());
    if (result.status === "recorded" || result.status === "duplicate") {
      return json({ ...result.feedback }, 200);
    }
    if (result.status === "not_saved") return json({ error: "not_saved" }, 404);
    if (result.status === "invalid_answer") return json({ error: "invalid_answer" }, 400);
    if (CONFLICTS.has(result.status)) return json({ error: result.status }, 409);
    return json({ error: "unavailable" }, 503);
  }, "Review answer");
}
