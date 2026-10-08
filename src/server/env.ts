import "server-only";

import { z } from "zod";

/**
 * Server environment, validated with Zod on first use.
 * Never import this from client components (enforced by `server-only`).
 * Public values would need the NEXT_PUBLIC_ prefix and must never be secrets.
 */
/** http is acceptable only on the developer's own machine (and the CI runner). */
const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Direct (non-pooled) connection for migrations; defaults to DATABASE_URL. */
    DATABASE_URL_UNPOOLED: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.url().optional(),
    /**
     * How account email (verification, password reset) is delivered. `resend` sends real email;
     * `outbox` writes each message to a local folder instead (development, tests, CI). Defaults
     * to `resend` in production and `outbox` everywhere else, so nothing is sent by accident.
     */
    EMAIL_TRANSPORT: z.enum(["resend", "outbox"]).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    /** The sender, e.g. `Lexora <account@mail.lexora.app>`, on a domain verified in Resend. */
    EMAIL_FROM: z.string().min(3).optional(),
    /** Where the outbox transport writes messages. Relative to the working directory. */
    EMAIL_OUTBOX_DIR: z.string().min(1).default(".email-outbox"),
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
      env.BETTER_AUTH_URL?.startsWith("http://") && !LOCAL_URL.test(env.BETTER_AUTH_URL);
    if (env.NODE_ENV === "production" && insecureRemote) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message:
          "BETTER_AUTH_URL must use https in production (http is allowed only for localhost)",
      });
    }
    const transport = env.EMAIL_TRANSPORT ?? (env.NODE_ENV === "production" ? "resend" : "outbox");
    if (transport === "resend") {
      for (const key of ["RESEND_API_KEY", "EMAIL_FROM"] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when account email is sent with Resend (EMAIL_TRANSPORT=resend, the production default)`,
          });
        }
      }
    }
    // The outbox is a local folder: on a deployed site, mail would silently go nowhere.
    if (
      env.NODE_ENV === "production" &&
      transport === "outbox" &&
      !LOCAL_URL.test(env.BETTER_AUTH_URL ?? "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_TRANSPORT"],
        message:
          "EMAIL_TRANSPORT=outbox is only for local and CI builds; a deployed site must use resend",
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
    EMAIL_TRANSPORT:
      env.EMAIL_TRANSPORT ?? (env.NODE_ENV === "production" ? "resend" : ("outbox" as const)),
    EMAIL_FROM: env.EMAIL_FROM ?? "Lexora <account@lexora.test>",
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
