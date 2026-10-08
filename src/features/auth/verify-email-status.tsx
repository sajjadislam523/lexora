"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Callout } from "@/components/lexora/callout";
import { Button } from "@/components/ui/button";

import { verifyEmailAction, type VerifyEmailResult } from "./actions";

type State = "verifying" | VerifyEmailResult;

function verify(token: string, onResult: (state: State) => void) {
  Promise.resolve(token ? verifyEmailAction(token) : ("invalid" as const))
    .then(onResult)
    .catch(() => onResult("unavailable"));
}

/**
 * Verifies the address from a verification link. The token is in the fragment (`#token=…`),
 * which never reaches a server; it is read once, removed from the address bar, and posted to a
 * server action. Verifying never signs anyone in, so what comes next depends only on whether the
 * person opening the link already has a session in this browser.
 */
export function VerifyEmailStatus({ signedIn }: { signedIn: boolean }) {
  const [state, setState] = useState<State>("verifying");
  const token = useRef<string | null>(null);

  useEffect(() => {
    // Strict Mode runs effects twice; the link must be read before it is cleared, once.
    if (token.current !== null) return;
    token.current = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    verify(token.current, setState);
  }, []);

  if (state === "verifying") {
    return (
      <p role="status" className="flex items-center gap-2 type-body text-muted-foreground">
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
        Verifying your email…
      </p>
    );
  }

  const next = signedIn
    ? { href: "/home", label: "Continue to Lexora" }
    : { href: "/sign-in", label: "Sign in" };
  const newLink = signedIn
    ? { href: "/settings#account-title", label: "Send a new link from Settings" }
    : { href: "/sign-in?next=/settings", label: "Sign in to send a new link" };

  if (state === "verified") {
    return (
      <div className="space-y-6">
        <Callout role="status" tone="success" title="Your email is verified">
          Thanks for confirming your address.{" "}
          {signedIn ? "You can carry on where you left off." : "Sign in whenever you’re ready."}
        </Callout>
        <Button asChild size="lg" className="w-full">
          <Link href={next.href}>{next.label}</Link>
        </Button>
      </div>
    );
  }

  if (state === "unavailable") {
    return (
      <div className="space-y-6">
        <Callout role="alert" tone="danger" title="We couldn’t verify your email just now">
          Lexora is having trouble. Your account works as normal — please try again in a few
          minutes.
        </Callout>
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            setState("verifying");
            verify(token.current ?? "", setState);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Callout
        role="alert"
        tone="warning"
        title={state === "expired" ? "This link has expired" : "This link isn’t valid"}
      >
        {state === "expired"
          ? "Verification links work for 24 hours."
          : "It may be incomplete — try opening it again from the email."}{" "}
        Your account works as normal in the meantime.
      </Callout>
      <div className="space-y-3">
        <Button asChild size="lg" className="w-full">
          <Link href={newLink.href}>{newLink.label}</Link>
        </Button>
        {signedIn ? null : (
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/explore">Explore language</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
