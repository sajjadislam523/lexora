"use client";

import Link from "next/link";
import { useState } from "react";

import { Callout } from "@/components/lexora/callout";
import { FormField, fieldAria } from "@/components/lexora/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

import { NETWORK_ERROR, forgotPasswordErrorMessage } from "./auth-messages";
import { forgotPasswordSchema } from "./schemas";
import { SubmitButton } from "./submit-button";

/**
 * Asks for a password reset link. The answer is the same whether or not the address has an
 * account, so the form can't be used to find out who uses Lexora.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setPending(true);
    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email: parsed.data.email,
      });
      if (authError) setFormError(forgotPasswordErrorMessage(authError));
      else setSentTo(parsed.data.email);
    } catch {
      setFormError(NETWORK_ERROR);
    }
    setPending(false);
  }

  if (sentTo) {
    return (
      <div className="space-y-6">
        <Callout role="status" tone="success" title="Check your email">
          If an account exists for <span className="font-medium wrap-break-word">{sentTo}</span>,
          we’ve sent a link to choose a new password. It works for 1 hour.
        </Callout>
        <p className="type-body text-muted-foreground">
          Nothing after a few minutes? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="rounded-xs font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            try again
          </button>
          .
        </p>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <Callout role="alert" tone="danger" title={formError} /> : null}

      <fieldset disabled={pending} className="space-y-4">
        <FormField id="email" label="Email" error={error}>
          <Input
            id="email"
            name="email"
            type="email"
            size="lg"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(undefined);
            }}
            {...fieldAria("email", error)}
          />
        </FormField>
      </fieldset>

      <SubmitButton pending={pending} pendingLabel="Sending…">
        Send reset link
      </SubmitButton>

      <p className="text-center type-body text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-ink hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
