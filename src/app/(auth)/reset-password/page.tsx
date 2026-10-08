import type { Metadata } from "next";

import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

/** Opened from a reset email. The token is in the link's fragment and read in the browser. */
export default function ResetPasswordPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="type-title text-foreground">Choose a new password</h1>
        <p className="type-reading text-muted-foreground">
          You’ll be signed out everywhere, then you can sign in with the new password.
        </p>
      </header>
      <ResetPasswordForm />
    </div>
  );
}
