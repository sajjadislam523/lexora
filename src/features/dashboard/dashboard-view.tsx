import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";

import { CATEGORY_BY_KIND } from "@/components/language/card-props";
import { Callout } from "@/components/lexora/callout";
import { LanguageRow } from "@/components/lexora/language-row";
import { MistakeRow } from "@/components/lexora/mistake-row";
import { PageHeader } from "@/components/lexora/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { evidenceText, type NextReview } from "@/learning/status";
import type { BankCounts } from "@/server/repositories/review-cards";
import type { Home } from "@/server/learning/home";

import { SavedLanguageLink } from "./saved-language-link";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Your next review is in 2 days." — whole days, as the bank says it. */
function nextReviewSentence(next: NextReview | null) {
  return next && !next.due
    ? `Your next review is in ${plural(next.days, "day")}.`
    : "Nothing is scheduled yet.";
}

/** "12 saved · 5 learning · 2 known": text, not tiles, and no zeros. */
function bankLine(counts: BankCounts) {
  return [
    `${counts.total} saved`,
    counts.learning > 0 ? `${counts.learning} learning` : null,
    counts.known > 0 ? `${counts.known} known` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function SectionHeading({
  id,
  title,
  link,
}: {
  id: string;
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="type-heading text-foreground">
        {title}
      </h2>
      {link ? (
        <Link
          href={link.href}
          className="-my-1 rounded-sm py-1 type-label text-ink hover:underline"
        >
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}

function VerificationReminder({ email }: { email: string }) {
  return (
    <Callout tone="info" title="Verify your email when it suits you">
      We sent a link to <span className="font-medium wrap-break-word">{email}</span>. Everything in
      Lexora works in the meantime. Need a new link?{" "}
      <Link href="/settings#account-title" className="font-medium text-ink hover:underline">
        Send one from Settings
      </Link>
      .
    </Callout>
  );
}

function FindLanguage({ variant = "outline" }: { variant?: "outline" | "default" }) {
  return (
    <Button asChild variant={variant}>
      <Link href="/finder">
        <Search data-icon="inline-start" />
        Find language
      </Link>
    </Button>
  );
}

function StartReview() {
  return (
    <Button asChild>
      <Link href="/practice">
        Start review
        <ArrowRight data-icon="inline-end" />
      </Link>
    </Button>
  );
}

/**
 * The learner's Home (Phase 5 specification §18): what is ready to review, the bank in one
 * line, recurring mistakes and the latest saves — all read from the learner's own data. With
 * nothing saved, one sentence on what the bank does and where to start.
 */
export function DashboardView({
  firstName,
  home,
  unverifiedEmail,
}: {
  firstName?: string;
  /** Null when the learner's data couldn't be read. */
  home: Home | null;
  /** The account email, while it is unverified. A reminder only — nothing is locked. */
  unverifiedEmail?: string;
}) {
  const reminder = unverifiedEmail ? <VerificationReminder email={unverifiedEmail} /> : null;

  if (!home) {
    return (
      <PageContainer className="space-y-10">
        <PageHeader title={firstName ? `Welcome back, ${firstName}` : "Welcome back"} />
        {reminder}
        <Callout tone="danger" title="Your Home isn’t available right now" role="alert">
          <p>Something went wrong on our side. Your saved language is safe; please try again.</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/home">Try again</Link>
          </Button>
        </Callout>
      </PageContainer>
    );
  }

  if (home.kind === "empty") {
    return (
      <PageContainer className="space-y-10">
        <PageHeader
          title={firstName ? `Welcome to Lexora, ${firstName}` : "Welcome to Lexora"}
          description="Save language from the Finder to start reviewing it."
          actions={<FindLanguage variant="default" />}
        />
        {reminder}
        <section
          aria-labelledby="start-bank"
          className="max-w-reading rounded-lg bg-highlight p-5 sm:p-6"
        >
          <h2 id="start-bank" className="type-heading text-highlight-foreground">
            Start your language bank
          </h2>
          <p className="mt-2 type-body text-foreground">
            Describe what you want to say in the Finder, then save the meanings worth remembering.
            Each one goes into your language bank and comes back for a short review when it’s due.
          </p>
        </section>
      </PageContainer>
    );
  }

  const { counts, ready, nextReview, recent, mistakes } = home;
  return (
    <PageContainer className="space-y-10">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description={
          ready > 0
            ? `${plural(ready, "meaning")} ${ready === 1 ? "is" : "are"} ready to review.`
            : `Nothing is due right now. ${nextReviewSentence(nextReview)}`
        }
        actions={
          <>
            <FindLanguage />
            {ready > 0 ? <StartReview /> : null}
          </>
        }
      />
      {reminder}

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-3">
        <div className="min-w-0 space-y-10 lg:col-span-2">
          <section
            aria-labelledby="ready-title"
            className="space-y-4 rounded-lg bg-highlight p-5 sm:p-6"
          >
            <div>
              <p className="type-overline text-muted-foreground">Ready to review</p>
              <h2 id="ready-title" className="mt-1.5 type-heading text-highlight-foreground">
                {ready > 0 ? `${plural(ready, "meaning")} ready now` : "Nothing is due right now"}
              </h2>
              <p className="mt-1 type-body text-foreground">
                {ready > 0
                  ? "A session takes up to five, one exercise each."
                  : nextReviewSentence(nextReview)}
              </p>
            </div>
            {ready > 0 ? (
              <StartReview />
            ) : (
              <Button asChild variant="outline">
                <Link href="/bank">Open language bank</Link>
              </Button>
            )}
          </section>

          <section aria-labelledby="bank-title">
            <SectionHeading
              id="bank-title"
              title="Your language bank"
              link={{ href: "/bank", label: "Open language bank" }}
            />
            <p className="type-body text-muted-foreground">{bankLine(counts)}</p>
          </section>

          {mistakes.length > 0 ? (
            <section aria-labelledby="mistakes-title">
              <SectionHeading id="mistakes-title" title="Recurring mistakes" />
              <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
                {mistakes.map((mistake) => (
                  <li key={`${mistake.term}:${mistake.kind}:${mistake.wrong}`}>
                    <MistakeRow
                      wrong={mistake.wrong}
                      right={mistake.right}
                      why={[mistake.why, evidenceText(mistake)].filter(Boolean).join(" ")}
                      action={{ label: `Open “${mistake.term}”`, href: mistake.href }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {recent.length > 0 ? (
            <section aria-labelledby="recent-title">
              <SectionHeading id="recent-title" title="Recently saved" />
              <div className="rounded-lg border border-border bg-card p-1">
                {recent.map((row) => (
                  <LanguageRow
                    key={row.senseId}
                    href={row.href}
                    term={row.senseLabel ? `${row.term} (${row.senseLabel})` : row.term}
                    category={CATEGORY_BY_KIND[row.kind]}
                    context={row.context}
                    status={row.status}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside
          aria-labelledby="quick-actions"
          className="space-y-3 lg:sticky lg:top-16 lg:self-start"
        >
          <h2 id="quick-actions" className="type-subheading text-foreground">
            Quick actions
          </h2>
          <nav aria-label="Quick actions" className="rounded-lg border border-border bg-card p-1">
            <Link
              href="/finder"
              className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-120 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block type-label text-foreground">Find language</span>
                <span className="block type-caption text-muted-foreground">
                  Describe what you want to say
                </span>
              </span>
            </Link>
            <SavedLanguageLink count={counts.total} />
          </nav>
        </aside>
      </div>
    </PageContainer>
  );
}
