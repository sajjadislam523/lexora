import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSession } from "@/server/auth/session";

/** Public landing page. Marketing pages arrive later; this one routes people in. */
export default async function LandingPage() {
  const session = await getSession();

  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center px-4 py-16 sm:px-6">
      <p className="type-overline text-subtle-foreground">IELTS Academic · In development</p>
      <h1 className="mt-3 type-display text-foreground">Lexora</h1>
      <p className="mt-4 type-reading text-muted-foreground">
        Find the right English. Use it naturally. Remember it when it matters.
      </p>
      <p className="mt-2 type-body text-subtle-foreground">
        A language-retrieval workspace for IELTS candidates. Accounts are real; the language content
        is still a prototype.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {session ? (
          <Button asChild>
            <Link href="/home">Open Lexora</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/sign-up">Create an account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </>
        )}
        <Button asChild variant="ghost">
          <Link href="/design-system">Design system</Link>
        </Button>
      </div>
    </main>
  );
}
