import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Placeholder home. The application shell and dashboard arrive in Phase 1. */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center px-4 py-16 sm:px-6">
      <p className="type-overline text-subtle-foreground">In development · Phase 0</p>
      <h1 className="mt-3 type-title text-foreground sm:type-display">Lexora</h1>
      <p className="mt-4 type-reading text-muted-foreground">
        Find the right English. Use it naturally. Remember it when it matters.
      </p>
      <p className="mt-2 type-body text-subtle-foreground">
        A language-retrieval workspace for IELTS Academic. The product is not built yet — only its
        foundation is.
      </p>
      <div className="mt-8">
        <Button asChild variant="outline">
          <Link href="/design-system">View the design system</Link>
        </Button>
      </div>
    </main>
  );
}
