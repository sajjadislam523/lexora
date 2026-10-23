import { CalendarCheck, Search } from "lucide-react";
import Link from "next/link";

import { Callout } from "@/components/lexora/callout";
import { EmptyState } from "@/components/lexora/empty-state";
import { PageHeader } from "@/components/lexora/page-header";
import { Button } from "@/components/ui/button";
import type { ReviewSession as Session } from "@/server/learning/review";

import { ReviewSession } from "./review-session";

const HEADER = {
  title: "Practice",
  description: "Short reviews of the language you’ve saved, when each one is due.",
};

/**
 * Practice (Phase 5 specification §14, §15): the learner's review session, or why there isn't
 * one. No counts are invented: "caught up" names the next review only when there is one.
 */
export function PracticeView({ session, loadedAt }: { session: Session; loadedAt: string }) {
  if (session.kind === "session") {
    // A new load (Review 5 more, a refresh) starts a new session.
    return <ReviewSession key={loadedAt} items={session.items} more={session.more} />;
  }
  if (session.kind === "empty") {
    return (
      <div className="space-y-8">
        <PageHeader {...HEADER} />
        <EmptyState
          icon={Search}
          title="Nothing to review yet"
          description="Save language from the Finder to start reviewing it."
          action={
            <Button asChild>
              <Link href="/finder">Find language</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const { nextReview } = session;
  return (
    <div className="space-y-8">
      <PageHeader {...HEADER} />
      <EmptyState
        icon={CalendarCheck}
        title="Nothing is due right now"
        description={
          nextReview && !nextReview.due
            ? `Your next review is in ${nextReview.days} ${nextReview.days === 1 ? "day" : "days"}.`
            : "You’re up to date with everything you’ve saved."
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/bank">Open language bank</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/finder">Find language</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}

/** The session couldn't be read: say so, without details, and offer another try. */
export function PracticeError() {
  return (
    <div className="space-y-8">
      <PageHeader {...HEADER} />
      <Callout tone="danger" title="Practice isn’t available right now" role="alert">
        <p>Nothing was lost: your saved language and its schedule are unchanged.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/practice">Try again</Link>
        </Button>
      </Callout>
    </div>
  );
}
