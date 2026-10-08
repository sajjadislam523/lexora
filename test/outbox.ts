import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

/**
 * Reads account email from the outbox transport (EMAIL_TRANSPORT=outbox): one JSON file per
 * message in EMAIL_OUTBOX_DIR. Shared by the integration and end-to-end tests, which run on the
 * same machine as the server they test.
 */
export type OutboxMessage = {
  file: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  sentAt: string;
};

export const OUTBOX_DIR = path.resolve(process.env.EMAIL_OUTBOX_DIR ?? ".email-outbox");

export async function emailsTo(to: string): Promise<OutboxMessage[]> {
  let files: string[];
  try {
    files = await readdir(OUTBOX_DIR);
  } catch {
    return [];
  }
  const messages: OutboxMessage[] = [];
  for (const name of files.filter((f) => f.endsWith(".json")).sort()) {
    const file = path.join(OUTBOX_DIR, name);
    try {
      const message = JSON.parse(await readFile(file, "utf8")) as Omit<OutboxMessage, "file">;
      if (message.to === to) messages.push({ ...message, file });
    } catch {
      // A message being written right now; it is read on the next poll.
    }
  }
  return messages;
}

/** Waits for the `count`-th message to an address (emails may be sent after the response). */
export async function waitForEmail(to: string, count = 1, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const messages = await emailsTo(to);
    if (messages.length >= count) return messages[count - 1]!;
    if (Date.now() > deadline) throw new Error(`No email #${count} arrived for ${to}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** The link in a message's plain-text body that goes to `pathname`. */
export function linkIn(message: OutboxMessage, pathname: "/verify-email" | "/reset-password") {
  const line = message.text.split("\n").find((l) => /^https?:\/\//.test(l.trim()));
  if (!line) throw new Error("The email has no link");
  const url = new URL(line.trim());
  if (url.pathname !== pathname)
    throw new Error(`Expected a ${pathname} link, got ${url.pathname}`);
  return url;
}

/** The token a link carries in its fragment. */
export function tokenIn(url: URL) {
  const token = new URLSearchParams(url.hash.slice(1)).get("token");
  if (!token) throw new Error("The link carries no token");
  return token;
}

export async function clearEmailsTo(to: string) {
  for (const message of await emailsTo(to)) await rm(message.file, { force: true });
}
