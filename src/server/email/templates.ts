import "server-only";

import type { EmailMessage } from "./sender";

/**
 * Account emails: short, plain and on-brand (docs/DESIGN.md → Account email).
 *
 * They never include the account's name: anyone can sign up with someone else's address, so
 * nothing a stranger typed may appear in a message Lexora sends. Email clients ignore CSS
 * variables and stylesheets, so the few colours below are copied from src/styles/tokens.css.
 */
const EMAIL_TOKENS = {
  background: "#faf9f6",
  card: "#ffffff",
  border: "#e7e4dd",
  foreground: "#1f1e1b",
  mutedForeground: "#5f5c55",
  primary: "#1f1e1b",
  primaryForeground: "#faf9f6",
  ink: "#4450a8",
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Template = {
  subject: string;
  heading: string;
  intro: string;
  action: string;
  url: string;
  validity: string;
  footer: string;
};

function render(to: string, t: Template): EmailMessage {
  const text = [
    "Lexora",
    "",
    t.heading,
    "",
    t.intro,
    "",
    `${t.action}:`,
    t.url,
    "",
    t.validity,
    "",
    t.footer,
  ].join("\n");

  const c = EMAIL_TOKENS;
  const url = escapeHtml(t.url);
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(t.subject)}</title></head>
<body style="margin:0;padding:0;background:${c.background};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.background};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${c.card};border:1px solid ${c.border};border-radius:8px;">
<tr><td style="padding:32px;font-family:${FONT};color:${c.foreground};">
<p style="margin:0 0 24px;font-size:15px;font-weight:600;">Lexora</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:28px;font-weight:600;">${escapeHtml(t.heading)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:24px;">${escapeHtml(t.intro)}</p>
<p style="margin:0 0 24px;"><a href="${url}" style="display:inline-block;padding:12px 20px;background:${c.primary};color:${c.primaryForeground};font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">${escapeHtml(t.action)}</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:${c.mutedForeground};">${escapeHtml(t.validity)} If the button doesn’t work, copy this link into your browser:</p>
<p style="margin:0 0 24px;font-size:13px;line-height:20px;word-break:break-all;"><a href="${url}" style="color:${c.ink};">${url}</a></p>
<p style="margin:0;font-size:13px;line-height:20px;color:${c.mutedForeground};">${escapeHtml(t.footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { to, subject: t.subject, text, html };
}

function hours(seconds: number) {
  const value = Math.round(seconds / 3600);
  return value === 1 ? "1 hour" : `${value} hours`;
}

export function verificationEmail(to: string, url: string, expiresIn: number): EmailMessage {
  return render(to, {
    subject: "Verify your email for Lexora",
    heading: "Verify your email",
    intro:
      "Confirm that this is your email address. Your Lexora account already works — verifying keeps it secure and lets you recover it if you forget your password.",
    action: "Verify email",
    url,
    validity: `This link works for ${hours(expiresIn)}.`,
    footer:
      "If you didn’t create a Lexora account, you can ignore this email. Opening the link doesn’t sign anyone in.",
  });
}

export function passwordResetEmail(to: string, url: string, expiresIn: number): EmailMessage {
  return render(to, {
    subject: "Reset your Lexora password",
    heading: "Reset your password",
    intro: "Someone asked to reset the password for the Lexora account with this email address.",
    action: "Choose a new password",
    url,
    validity: `This link works for ${hours(expiresIn)} and can be used once.`,
    footer:
      "If you didn’t ask for this, you don’t need to do anything — your password stays the same.",
  });
}
