import { SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Global 404. Calm, honest, and points somewhere useful. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col items-start justify-center gap-5 px-4 py-16 sm:px-6">
      <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-4.5" />
      </span>
      <div className="space-y-2">
        <p className="type-overline text-subtle-foreground">Page not found</p>
        <h1 className="type-title text-foreground">This page doesn’t exist</h1>
        <p className="type-reading text-muted-foreground">
          The link may be out of date, or the language item isn’t in Lexora yet.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/explore">Explore Lexora</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go to the home page</Link>
        </Button>
      </div>
    </main>
  );
}
