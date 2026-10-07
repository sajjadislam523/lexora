"use client";

import { ArrowLeft, Dumbbell } from "lucide-react";
import Link from "next/link";

import { SaveLanguageButton } from "@/components/language/save-language-button";
import { useViewer } from "@/components/language/saved-language";
import { Button } from "@/components/ui/button";

/**
 * Back to search: the signed-in Finder for learners, public Explore for visitors.
 * The label is the same for both, so nothing shifts once the session check resolves.
 */
export function BackToSearch() {
  const viewer = useViewer();
  return (
    <Link
      href={viewer === "signed-in" ? "/finder" : "/explore"}
      className="inline-flex items-center gap-1.5 rounded-sm type-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Back to search
    </Link>
  );
}

/**
 * Account actions on a language page. Everyone sees Save (visitors get the save gate);
 * practice links appear for signed-in learners only.
 */
export function LanguageActions({
  slug,
  term,
  practiceHref,
}: {
  slug: string;
  term: string;
  practiceHref: string;
}) {
  const viewer = useViewer();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <SaveLanguageButton slug={slug} term={term} />
        {viewer === "signed-in" ? (
          <Button asChild variant="ghost">
            <Link href={practiceHref}>
              <Dumbbell data-icon="inline-start" />
              Practise this
            </Link>
          </Button>
        ) : null}
      </div>
      {viewer === "signed-in" ? (
        <p className="type-caption text-subtle-foreground">
          Saved for this session only — permanent saving arrives with the language bank.
        </p>
      ) : null}
    </div>
  );
}
