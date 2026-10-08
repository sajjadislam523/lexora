import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { serverEnv } from "@/server/env";

/**
 * Account email delivery behind one small interface (docs/ARCHITECTURE.md → Account email).
 * Resend sends real mail; the outbox writes each message to a local folder so development, tests
 * and CI can follow verification and reset links without sending anything.
 */
export type EmailMessage = { to: string; subject: string; text: string; html: string };

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * A delivery failure. Its message names the cause only (an HTTP status, an error name) — never
 * the recipient, the content or the link, so it is safe to log.
 */
export class EmailDeliveryError extends Error {
  override name = "EmailDeliveryError";
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage) {
    let response: Response;
    try {
      response = await this.fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new EmailDeliveryError(
        `Resend unreachable (${error instanceof Error ? error.name : "unknown"})`,
      );
    }
    // The response body is not read: only the status is needed, and it is safe to log.
    if (!response.ok) throw new EmailDeliveryError(`Resend answered ${response.status}`);
  }
}

/** Writes each message as a JSON file. Local and CI only (the env schema enforces it). */
export class OutboxEmailSender implements EmailSender {
  constructor(
    private readonly dir: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage) {
    try {
      await mkdir(this.dir, { recursive: true });
      const file = path.join(this.dir, `${Date.now()}-${randomUUID()}.json`);
      const body = { from: this.from, ...message, sentAt: new Date().toISOString() };
      await writeFile(file, JSON.stringify(body, null, 2), { mode: 0o600 });
    } catch (error) {
      throw new EmailDeliveryError(
        `Outbox not writable (${error instanceof Error ? error.name : "unknown"})`,
      );
    }
  }
}

let sender: EmailSender | undefined;

/** The configured sender: EMAIL_TRANSPORT, validated in src/server/env.ts. */
export function emailSender(): EmailSender {
  if (sender) return sender;
  const env = serverEnv();
  if (env.EMAIL_TRANSPORT === "resend") {
    // The env schema requires the key whenever the transport is resend.
    sender = new ResendEmailSender(env.RESEND_API_KEY!, env.EMAIL_FROM);
  } else {
    sender = new OutboxEmailSender(path.resolve(env.EMAIL_OUTBOX_DIR), env.EMAIL_FROM);
  }
  return sender;
}
