import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Placeholder landing page. Public marketing pages arrive in a later phase. */
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center px-4 py-16 sm:px-6">
      <p className="type-overline text-subtle-foreground">In development · Phase 1</p>
      <h1 className="mt-3 type-display text-foreground">Lexora</h1>
      <p className="mt-4 type-reading text-muted-foreground">
        Find the right English. Use it naturally. Remember it when it matters.
      </p>
      <p className="mt-2 type-body text-subtle-foreground">
        A language-retrieval workspace for IELTS Academic. What exists today is a visual prototype:
        nothing is saved and nothing is searched yet.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/home">Open the prototype</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/design-system">View the design system</Link>
        </Button>
      </div>
    </main>
  );
}
