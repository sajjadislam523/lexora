import "server-only";

import { z } from "zod";

/**
 * Server environment, validated with Zod on first use.
 * Never import this from client components (enforced by `server-only`).
 * Public values would need the NEXT_PUBLIC_ prefix and must never be secrets.
 */
export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Direct (non-pooled) connection for migrations; defaults to DATABASE_URL. */
    DATABASE_URL_UNPOOLED: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.url().optional(),
    /** Optional future intelligence layer (Phase 9). Lexora never requires it. */
    AI_PROVIDER: z.enum(["none", "anthropic", "openai", "local"]).default("none"),
    AI_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.BETTER_AUTH_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "BETTER_AUTH_URL is required in production",
      });
    }
    const insecureRemote =
      env.BETTER_AUTH_URL?.startsWith("http://") &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(env.BETTER_AUTH_URL);
    if (env.NODE_ENV === "production" && insecureRemote) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message:
          "BETTER_AUTH_URL must use https in production (http is allowed only for localhost)",
      });
    }
    if (env.AI_PROVIDER !== "none" && env.AI_PROVIDER !== "local" && !env.AI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_API_KEY"],
        message: "AI_API_KEY is required when AI_PROVIDER uses a hosted provider",
      });
    }
  })
  .transform((env) => ({
    ...env,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? "http://localhost:3000",
  }));

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Report which variables are wrong, never their values.
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${problems}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Validated server environment. Throws a readable error on misconfiguration. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
