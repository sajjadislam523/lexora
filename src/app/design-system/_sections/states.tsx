import { BookMarked, SearchX } from "lucide-react";

import { Callout } from "@/components/lexora/callout";
import { EmptyState } from "@/components/lexora/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { Section, Specimen } from "./section";

function ResultCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5" aria-hidden>
      <Skeleton className="h-5 w-20" />
      <Skeleton className="mt-3 h-6 w-40" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-4 h-12 w-full" />
    </div>
  );
}

export function StatesSection() {
  return (
    <Section
      id="states"
      eyebrow="Components"
      title="States & feedback"
      description="Every view needs an empty, loading and error state before it ships."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <Specimen title="Empty state" note="Explain, then point somewhere.">
          <div className="space-y-4">
            <EmptyState
              icon={BookMarked}
              title="Your language bank is empty"
              description="Save words, linkers and patterns from the Finder and they will appear here for review."
              action={<Button size="sm">Open Language Finder</Button>}
            />
            <EmptyState
              icon={SearchX}
              title="No results for “responsable for”"
              description="Check the spelling, or describe the idea instead — for example “I want to express contrast”."
            />
          </div>
        </Specimen>

        <Specimen
          title="Loading"
          note="Skeletons mirror the final layout. No spinners for content."
        >
          <div role="status" aria-label="Loading results" className="space-y-4">
            <ResultCardSkeleton />
            <ResultCardSkeleton />
          </div>
        </Specimen>
      </div>

      <Specimen
        title="Callouts"
        note="Inline feedback for practice, audits and forms. Icon + words, never colour alone."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Callout tone="success" title="Correct">
            “responsible for” takes <em>for</em>, followed by a noun or -ing form.
          </Callout>
          <Callout tone="danger" title="Not quite">
            “responsible of” is a common error. Use “responsible for”.
          </Callout>
          <Callout tone="warning" title="Repeated word">
            You used “important” four times. Consider “significant” or “crucial”.
          </Callout>
          <Callout tone="info" title="Register">
            “Furthermore” is formal. In speaking, “Also” or “On top of that” sound more natural.
          </Callout>
        </div>
      </Specimen>
    </Section>
  );
}
