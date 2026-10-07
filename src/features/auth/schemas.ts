import { z } from "zod";

/** Mirrors the server's rules (Better Auth: 8–128 characters) for instant feedback. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer"),
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Use ${PASSWORD_MAX} characters or fewer`),
});

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

/** First error message per field, for inline display. */
export function fieldErrors<T extends string>(error: z.ZodError): FieldErrors<T> {
  const result: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as T | undefined;
    if (key && !result[key]) result[key] = issue.message;
  }
  return result;
}
