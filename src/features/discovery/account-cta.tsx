"use client";

import Link from "next/link";

import { useViewer } from "@/components/language/saved-language";
import { Button } from "@/components/ui/button";

/** Closing call to action: create an account, or — for a signed-in learner — go back in. */
export function AccountCta() {
  const viewer = useViewer();

  if (viewer === "signed-in") {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/home">Open Lexora</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button asChild>
        <Link href="/sign-up">Create free account</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/explore">Keep exploring</Link>
      </Button>
    </div>
  );
}
