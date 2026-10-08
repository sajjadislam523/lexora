import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { customSession } from "better-auth/plugins";

import { AUTH_COOKIE_PREFIX } from "@/lib/auth-constants";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { serverEnv } from "@/server/env";
import { isSameOrigin } from "@/server/http/same-origin";

import {
  EMAIL_VERIFICATION_EXPIRES_IN,
  PASSWORD_RESET_EXPIRES_IN,
  runAfterResponse,
  sendEmailVerification,
  sendPasswordReset,
} from "./emails";
import { redactSessionTokens } from "./redact";

const env = serverEnv();

/**
 * Reset endpoints take no cookie, so Better Auth's CSRF check (which runs only when a cookie is
 * sent) doesn't cover them. They act on an email address or a token rather than a session, but a
 * page on another site could still make its visitors' browsers request reset emails from many
 * addresses at once, around the per-address rate limit. Browser requests must come from Lexora.
 */
const SAME_ORIGIN_ONLY = new Set(["/request-password-reset", "/reset-password"]);

/**
 * Better Auth configuration — the only place authentication is configured.
 * Password hashing (scrypt), session tokens, CSRF/origin checks and cookie handling are all
 * Better Auth's built-in mechanisms; Lexora adds no custom crypto.
 *
 * Extending later: add `socialProviders: { google: { clientId, clientSecret } }` — the `accounts`
 * table already supports one user with several providers.
 */
export const auth = betterAuth({
  appName: "Lexora",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Verification never gates learning (Phase 3 decision 3): an unverified learner signs in and
    // uses everything. Verification secures the address; it is not an access check.
    requireEmailVerification: false,
    // Reset tokens are Better Auth's: random, stored hashed (see `verification`), single use.
    resetPasswordTokenExpiresIn: PASSWORD_RESET_EXPIRES_IN,
    sendResetPassword: ({ user, token }) => sendPasswordReset(user.email, token),
    // A reset ends every session, so a session obtained before the reset (by anyone) stops working.
    revokeSessionsOnPasswordReset: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: false,
    // The link verifies the address and nothing more: it never signs anyone in or creates a session.
    autoSignInAfterVerification: false,
    expiresIn: EMAIL_VERIFICATION_EXPIRES_IN,
    sendVerificationEmail: ({ user, token }) => sendEmailVerification(user.email, token),
  },

  // Single-use tokens (password reset) are stored as SHA-256 hashes, so a database read can't
  // reveal a usable link. Verification links are signed JWTs and aren't stored at all.
  verification: { storeIdentifier: "hashed" },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
    // Every request validates against the database; no signed cookie cache.
    cookieCache: { enabled: false },
  },

  rateLimit: {
    enabled: env.NODE_ENV !== "test",
    // Database storage works across serverless instances (memory would not).
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      // Each of these sends an email. Better Auth's own defaults, stated here so they're visible.
      "/send-verification-email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      // Submitting a new password with a reset token.
      "/reset-password": { window: 60, max: 5 },
    },
  },

  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    useSecureCookies: env.NODE_ENV === "production" && env.BETTER_AUTH_URL.startsWith("https://"),
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    // Emails on sign-up and reset requests are sent after the response (see runAfterResponse).
    backgroundTasks: { handler: runAfterResponse },
  },

  telemetry: { enabled: false },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Only HTTP requests carry a request; Lexora's own server calls (auth.api) don't.
      if (ctx.request && SAME_ORIGIN_ONLY.has(ctx.path) && !isSameOrigin(ctx.request)) {
        throw APIError.from("FORBIDDEN", { code: "INVALID_ORIGIN", message: "Invalid origin" });
      }
      // A new verification email is for the signed-in learner's own address. Better Auth would
      // also send one to any unverified address without a session; Lexora never needs that, and
      // refusing it stops strangers from mailing an address someone else signed up with.
      if (ctx.path === "/send-verification-email" && !(await getSessionFromCtx(ctx))) {
        throw APIError.from("UNAUTHORIZED", {
          code: "SIGN_IN_REQUIRED",
          message: "Sign in to send a verification email.",
        });
      }
    }),
    // Session tokens travel only in the HttpOnly cookie. Strip them from every JSON body
    // (sign-in, sign-up, list-sessions …) using Better Auth's documented after-hook; the
    // Set-Cookie headers set by the endpoint are preserved.
    after: createAuthMiddleware(async (ctx) => {
      const returned = ctx.context.returned;
      if (returned === undefined || returned instanceof Response || returned instanceof APIError)
        return;
      const redacted = redactSessionTokens(returned);
      // ctx.json serialises any JSON value; its type only names objects (list-sessions is an array).
      if (redacted !== returned) return ctx.json(redacted as Record<string, unknown>);
    }),
  },

  plugins: [
    // The session token lives only in the HttpOnly cookie — strip it from JSON session responses
    // so client-side code (and any injected script) can never read it.
    customSession(async ({ user, session }) => {
      const { token: _token, ...safeSession } = session;
      return { user, session: safeSession };
    }),
    // Lets server actions set auth cookies through next/headers. Must stay last.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
