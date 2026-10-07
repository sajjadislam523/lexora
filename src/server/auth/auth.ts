import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { customSession } from "better-auth/plugins";

import { AUTH_COOKIE_PREFIX } from "@/lib/auth-constants";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { serverEnv } from "@/server/env";

import { redactSessionTokens } from "./redact";

const env = serverEnv();

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
    // No email provider yet; verification and password reset arrive with one.
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
  },

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
    },
  },

  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    useSecureCookies: env.NODE_ENV === "production" && env.BETTER_AUTH_URL.startsWith("https://"),
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },

  telemetry: { enabled: false },

  hooks: {
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
