"use client";

import { CircleCheck, LoaderCircle, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Outcome = { tone: "success" | "danger"; text: string };

/**
 * Verification status for the account email, and a way to ask for a new link. Verification is
 * never required to use Lexora; this only secures the address. Better Auth sends the email to
 * the signed-in learner's own address (it refuses any other) and rate-limits the endpoint.
 */
export function EmailVerification({ email, verified }: { email: string; verified: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  if (verified) {
    return (
      <p className="flex items-center gap-1.5 type-caption text-success">
        <CircleCheck aria-hidden className="size-3.5" />
        Verified
      </p>
    );
  }

  async function send() {
    setPending(true);
    setOutcome(null);
    try {
      const { error } = await authClient.sendVerificationEmail({ email });
      if (!error) {
        setOutcome({
          tone: "success",
          text: `Sent. Open the link in the email to ${email} — it works for 24 hours.`,
        });
      } else if (error.code === "EMAIL_ALREADY_VERIFIED") {
        setOutcome({ tone: "success", text: "Your email is already verified." });
        router.refresh();
      } else if (error.status === 429) {
        setOutcome({
          tone: "danger",
          text: "You’ve asked for several emails just now. Wait a minute, then try again.",
        });
      } else if (error.status === 401) {
        setOutcome({ tone: "danger", text: "Your session has ended. Sign in again to continue." });
      } else {
        setOutcome({
          tone: "danger",
          text: "We couldn’t send the email right now. Please try again in a few minutes.",
        });
      }
    } catch {
      setOutcome({ tone: "danger", text: "Lexora can’t be reached. Check your connection." });
    }
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <p className="type-caption text-muted-foreground">
        Not verified yet. Lexora works fully either way; verifying keeps your account secure.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={send} disabled={pending} aria-busy={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : (
            <Mail data-icon="inline-start" aria-hidden />
          )}
          {pending ? "Sending…" : "Send verification email"}
        </Button>
        <p
          role="status"
          className={
            outcome?.tone === "danger" ? "type-caption text-danger" : "type-caption text-success"
          }
        >
          {outcome?.text}
        </p>
      </div>
    </div>
  );
}
