"use client";

import { LoaderCircle, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Callout } from "@/components/lexora/callout";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Outcome = { tone: "success" | "danger"; text: string };

/**
 * The prompt to verify the account email, with a way to ask for a new link; Settings shows it
 * only while the email is unverified. Verification is never required to use Lexora; this only
 * secures the address. Better Auth sends the email to the signed-in learner's own address (it
 * refuses any other) and rate-limits the endpoint.
 */
export function EmailVerification({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

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
    <Callout tone="info" title="Your email isn’t verified yet">
      <p>Verify it to help keep your account secure. Lexora works fully either way.</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
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
    </Callout>
  );
}
