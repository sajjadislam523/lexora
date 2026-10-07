/**
 * Removes session tokens from Better Auth JSON responses.
 *
 * Lexora authenticates with the HttpOnly session cookie only (no bearer tokens), so a token in a
 * response body is never needed — and anything in a body is readable by browser JavaScript.
 * Applied by the documented `hooks.after` extension point in auth.ts; cookies are unaffected.
 *
 * Covers: top-level `token` (sign-in / sign-up), nested `session.token` (session payloads), and
 * arrays of session rows (`/list-sessions`). Returns the same reference when nothing changes.
 */
type Json = unknown;

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeSession(value: Record<string, Json>) {
  return "token" in value && "userId" in value && "expiresAt" in value;
}

function withoutToken(value: Record<string, Json>) {
  const { token: _token, ...rest } = value;
  return rest;
}

export function redactSessionTokens(value: Json): Json {
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      if (isRecord(item) && looksLikeSession(item)) {
        changed = true;
        return withoutToken(item);
      }
      return item;
    });
    return changed ? items : value;
  }

  if (!isRecord(value)) return value;

  let changed = false;
  let result: Record<string, Json> = value;
  if ("token" in result) {
    result = withoutToken(result);
    changed = true;
  }
  if (isRecord(result.session) && "token" in result.session) {
    result = { ...result, session: withoutToken(result.session) };
    changed = true;
  }
  return changed ? result : value;
}
