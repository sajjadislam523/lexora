import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/features/auth/sign-in-form";
import { safeRedirect } from "@/lib/safe-redirect";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const params = await props.searchParams;
  const next = safeRedirect(typeof params.next === "string" ? params.next : undefined);
  const reason = params.reason;
  const notice =
    reason === "session-expired" || reason === "signed-out" || reason === "password-reset"
      ? reason
      : undefined;

  // Already signed in with a valid session: go straight to the app.
  if (await getSession()) redirect(next);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="type-title text-foreground">Sign in</h1>
        <p className="type-reading text-muted-foreground">
          Welcome back. Pick up where you left off.
        </p>
      </header>
      <SignInForm next={next} notice={notice} />
    </div>
  );
}
