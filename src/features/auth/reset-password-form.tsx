"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { Callout } from "@/components/lexora/callout";
import { FormField, fieldAria, focusFirstInvalid } from "@/components/lexora/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

import { NETWORK_ERROR, resetPasswordErrorMessage } from "./auth-messages";
import { PasswordInput } from "./password-input";
import { PASSWORD_MIN, fieldErrors, resetPasswordSchema, type FieldErrors } from "./schemas";
import { SubmitButton } from "./submit-button";

type Field = "password" | "confirm";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * The reset token arrives in the link's fragment (`#token=…`), which browsers never send to a
 * server. It is read here and posted to Better Auth in the request body. `undefined` while the
 * page is rendered on the server.
 */
function useResetToken() {
  return useSyncExternalStore(
    subscribeToHash,
    () => new URLSearchParams(window.location.hash.slice(1)).get("token"),
    () => undefined,
  );
}

function InvalidLink() {
  return (
    <div className="space-y-6">
      <Callout role="alert" tone="danger" title="This link can’t be used">
        Reset links work once, for 1 hour. Ask for a new one and use the latest email.
      </Callout>
      <Button asChild size="lg" className="w-full">
        <Link href="/forgot-password">Send a new link</Link>
      </Button>
    </div>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useResetToken();
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (token === null || formError === "invalid-link") return <InvalidLink />;

  function setField(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors<Field>(parsed.error));
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setPending(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: parsed.data.password,
        token,
      });
      if (error) {
        setFormError(resetPasswordErrorMessage(error));
        setPending(false);
        return;
      }
      // Every session has ended; sign in with the new password.
      router.replace("/sign-in?reason=password-reset");
    } catch {
      setFormError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <Callout role="alert" tone="danger" title={formError} /> : null}

      <fieldset disabled={pending || token === undefined} className="space-y-4">
        <FormField
          id="password"
          label="New password"
          error={errors.password}
          hint={`At least ${PASSWORD_MIN} characters. A short phrase works well.`}
        >
          <PasswordInput
            id="password"
            name="password"
            size="lg"
            autoComplete="new-password"
            autoFocus
            value={values.password}
            onChange={(e) => setField("password", e.target.value)}
            {...fieldAria("password", errors.password, true)}
          />
        </FormField>
        <FormField id="confirm" label="Confirm new password" error={errors.confirm}>
          <PasswordInput
            id="confirm"
            name="confirm"
            size="lg"
            autoComplete="new-password"
            value={values.confirm}
            onChange={(e) => setField("confirm", e.target.value)}
            {...fieldAria("confirm", errors.confirm)}
          />
        </FormField>
      </fieldset>

      <SubmitButton pending={pending} pendingLabel="Changing your password…">
        Change password
      </SubmitButton>
    </form>
  );
}
