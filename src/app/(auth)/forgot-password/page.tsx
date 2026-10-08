import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="type-title text-foreground">Reset your password</h1>
        <p className="type-reading text-muted-foreground">
          Enter the email you use for Lexora and we’ll send you a link to choose a new password.
        </p>
      </header>
      <ForgotPasswordForm />
    </div>
  );
}
