import type { Metadata } from "next";

import { VerifyEmailStatus } from "@/features/auth/verify-email-status";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

/**
 * Opened from a verification email. Verifying only confirms the address: it never signs anyone
 * in (Phase 3 decision 3). The session is read only to offer the right next step.
 */
export default async function VerifyEmailPage() {
  const session = await getSession();
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="type-title text-foreground">Verify your email</h1>
        <p className="type-reading text-muted-foreground">
          Confirming your address keeps your account secure. Lexora works fully either way.
        </p>
      </header>
      <VerifyEmailStatus signedIn={Boolean(session)} />
    </div>
  );
}
