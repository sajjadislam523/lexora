import "server-only";

import { APIError } from "better-auth/api";
import { after } from "next/server";

import { EmailDeliveryError, emailSender, type EmailMessage } from "@/server/email/sender";
import { passwordResetEmail, verificationEmail } from "@/server/email/templates";
import { serverEnv } from "@/server/env";

/**
 * The bridge between Better Auth's email callbacks and Lexora's email delivery. Better Auth owns
 * the tokens (creation, expiry, single use); this module only puts them into links and sends.
 */

/** Verification proves an address; it grants nothing, so a day is a comfortable window. */
export const EMAIL_VERIFICATION_EXPIRES_IN = 60 * 60 * 24;
/** Better Auth's default: a reset link is a credential, so it is short-lived and single-use. */
export const PASSWORD_RESET_EXPIRES_IN = 60 * 60;

/**
 * Links carry the token in the URL fragment (`#token=…`). Browsers never send a fragment to a
 * server, so the token stays out of request logs, analytics and `Referer`; the page reads it in
 * the browser and hands it to Better Auth in a POST body.
 */
function link(pathname: string, token: string) {
  const url = new URL(pathname, serverEnv().BETTER_AUTH_URL);
  url.hash = new URLSearchParams({ token }).toString();
  return url.href;
}

export function emailVerificationLink(token: string) {
  return link("/verify-email", token);
}

export function passwordResetLink(token: string) {
  return link("/reset-password", token);
}

async function deliver(kind: string, message: EmailMessage) {
  try {
    await emailSender().send(message);
  } catch (error) {
    // Only the cause — never the address, the link or the token.
    const reason = error instanceof EmailDeliveryError ? error.message : "unexpected error";
    console.error(`Account email not sent (${kind}): ${reason}`);
    throw APIError.from("SERVICE_UNAVAILABLE", {
      code: "EMAIL_NOT_SENT",
      message: "The email couldn’t be sent. Please try again later.",
    });
  }
}

export function sendEmailVerification(to: string, token: string) {
  return deliver(
    "verification",
    verificationEmail(to, emailVerificationLink(token), EMAIL_VERIFICATION_EXPIRES_IN),
  );
}

export function sendPasswordReset(to: string, token: string) {
  return deliver(
    "password reset",
    passwordResetEmail(to, passwordResetLink(token), PASSWORD_RESET_EXPIRES_IN),
  );
}

/**
 * Better Auth's background-task handler. Emails sent on sign-up and on a reset request finish
 * after the response, so the response neither waits for the provider nor takes longer when an
 * account exists (a timing signal for account enumeration). `after` keeps the work alive on
 * serverless platforms; outside a request (scripts, tests) the task simply runs on.
 */
export function runAfterResponse(task: Promise<unknown>) {
  try {
    after(() => task);
  } catch {
    // Not inside a request: nothing to extend. Better Auth has already attached error handling.
  }
}
