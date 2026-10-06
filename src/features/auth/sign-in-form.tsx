"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Callout } from "@/components/lexora/callout";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

import { NETWORK_ERROR, signInErrorMessage } from "./auth-messages";
import { FormField, fieldAria } from "./form-field";
import { PasswordInput } from "./password-input";
import { fieldErrors, signInSchema, type FieldErrors } from "./schemas";
import { SubmitButton } from "./submit-button";

type Field = "email" | "password";

export function SignInForm({
  next,
  notice,
}: {
  next: string;
  notice?: "session-expired" | "signed-out";
}) {
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function setField(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validateField(field: Field) {
    const result = signInSchema.shape[field].safeParse(values[field]);
    setErrors((e) => ({
      ...e,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = signInSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors<Field>(parsed.error));
      return;
    }
    setPending(true);
    try {
      const { error } = await authClient.signIn.email(parsed.data);
      if (error) {
        setFormError(signInErrorMessage(error));
        setPending(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setFormError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5"
      aria-describedby={formError ? "sign-in-error" : undefined}
    >
      {notice === "session-expired" && !formError ? (
        <Callout tone="info" title="Your session ended">
          For your security you’ve been signed out. Sign in again to continue where you left off.
        </Callout>
      ) : null}
      {notice === "signed-out" && !formError ? (
        <Callout tone="success" title="You’ve signed out">
          See you next time.
        </Callout>
      ) : null}
      {formError ? (
        <Callout id="sign-in-error" role="alert" tone="danger" title={formError} />
      ) : null}

      <fieldset disabled={pending} className="space-y-4">
        <FormField id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            size="lg"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            onBlur={() => values.email && validateField("email")}
            {...fieldAria("email", errors.email)}
          />
        </FormField>
        <FormField id="password" label="Password" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            size="lg"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => setField("password", e.target.value)}
            {...fieldAria("password", errors.password)}
          />
        </FormField>
      </fieldset>

      <SubmitButton pending={pending} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>

      <p className="text-center type-body text-muted-foreground">
        New to Lexora?{" "}
        <Link
          href={next === "/home" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`}
          className="font-medium text-ink hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
