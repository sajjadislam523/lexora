"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Callout } from "@/components/lexora/callout";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

import { NETWORK_ERROR, signUpErrorMessage } from "./auth-messages";
import { FormField, fieldAria } from "@/components/lexora/form-field";
import { PasswordInput } from "./password-input";
import { PASSWORD_MIN, fieldErrors, signUpSchema, type FieldErrors } from "./schemas";
import { SubmitButton } from "./submit-button";

type Field = "name" | "email" | "password";

export function SignUpForm({ next }: { next: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function setField(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validateField(field: Field) {
    const result = signUpSchema.shape[field].safeParse(values[field]);
    setErrors((e) => ({
      ...e,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors<Field>(parsed.error));
      return;
    }
    setPending(true);
    try {
      const { error } = await authClient.signUp.email(parsed.data);
      if (error) {
        setFormError(signUpErrorMessage(error));
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

  const signInHref = next === "/home" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError === "exists" ? (
        <Callout role="alert" tone="info" title="You already have an account">
          An account with this email exists.{" "}
          <Link href={signInHref} className="font-medium text-ink hover:underline">
            Sign in instead
          </Link>
          .
        </Callout>
      ) : formError ? (
        <Callout role="alert" tone="danger" title={formError} />
      ) : null}

      <fieldset disabled={pending} className="space-y-4">
        <FormField id="name" label="Name" error={errors.name}>
          <Input
            id="name"
            name="name"
            size="lg"
            autoComplete="name"
            autoFocus
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            onBlur={() => values.name && validateField("name")}
            {...fieldAria("name", errors.name)}
          />
        </FormField>
        <FormField id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            size="lg"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            onBlur={() => values.email && validateField("email")}
            {...fieldAria("email", errors.email)}
          />
        </FormField>
        <FormField
          id="password"
          label="Password"
          error={errors.password}
          hint={`At least ${PASSWORD_MIN} characters. A short phrase works well.`}
        >
          <PasswordInput
            id="password"
            name="password"
            size="lg"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => setField("password", e.target.value)}
            onBlur={() => values.password && validateField("password")}
            {...fieldAria("password", errors.password, true)}
          />
        </FormField>
      </fieldset>

      <SubmitButton pending={pending} pendingLabel="Creating your account…">
        Create account
      </SubmitButton>

      <p className="text-center type-body text-muted-foreground">
        Already have an account?{" "}
        <Link href={signInHref} className="font-medium text-ink hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
