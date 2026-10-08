import { ArrowRight, Dumbbell, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Callout } from "@/components/lexora/callout";
import { CategoryBadge } from "@/components/lexora/category-badge";
import { LanguageRow } from "@/components/lexora/language-row";
import { MistakeRow } from "@/components/lexora/mistake-row";
import { PageHeader } from "@/components/lexora/page-header";
import { ProgressTrack } from "@/components/lexora/progress-track";
import { PageContainer } from "@/components/shell/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireLanguageItem } from "@/demo/language";
import { SAMPLE_LEARNER } from "@/demo/learner";

import { SavedLanguageLink } from "./saved-language-link";

const QUICK_ACTIONS = [
  {
    href: "/finder",
    label: "Find language",
    detail: "Describe what you want to say",
    icon: Search,
  },
  {
    href: "/practice",
    label: "Practice now",
    detail: "Five questions, about 4 minutes",
    icon: Dumbbell,
  },
  {
    href: "#recent-mistakes",
    label: "Review mistakes",
    detail: "3 corrections waiting",
    icon: TriangleAlert,
  },
];

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

/** The learner's workspace: what to retrieve today, what to fix, where to go next. */
export function DashboardView({
  firstName,
  savedCount,
  unverifiedEmail,
}: {
  firstName?: string;
  /** Saved meanings, from the database. */
  savedCount: number;
  /** The account email, while it is unverified. A reminder only — nothing is locked. */
  unverifiedEmail?: string;
}) {
  const { focus, review, weakAreas, continueLearning, mistakes } = SAMPLE_LEARNER;

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        eyebrow={<Badge variant="outline">Sample learner data</Badge>}
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description={focus}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/finder">
                <Search data-icon="inline-start" />
                Find language
              </Link>
            </Button>
            <Button asChild>
              <Link href="/practice">
                Start today’s practice
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </>
        }
      />

      {unverifiedEmail ? (
        <Callout tone="info" title="Verify your email when it suits you">
          We sent a link to <span className="font-medium wrap-break-word">{unverifiedEmail}</span>.
          Everything in Lexora works in the meantime. Need a new link?{" "}
          <Link href="/settings#account-title" className="font-medium text-ink hover:underline">
            Send one from Settings
          </Link>
          .
        </Callout>
      ) : null}

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-3">
        <div className="min-w-0 space-y-10 lg:col-span-2">
          <section
            aria-labelledby="todays-focus"
            className="grid gap-6 rounded-lg bg-highlight p-5 sm:grid-cols-5 sm:p-6"
          >
            <div className="space-y-4 sm:col-span-3">
              <div>
                <p className="type-overline text-muted-foreground">Today’s focus</p>
                <h2 id="todays-focus" className="mt-1.5 type-heading text-highlight-foreground">
                  {review.total} items to review · about {review.minutes} minutes
                </h2>
              </div>
              <div className="space-y-1.5">
                <ProgressTrack
                  value={review.done}
                  max={review.total}
                  label="Today's review"
                  trackClassName="bg-highlight-foreground/10"
                />
                <p className="type-caption text-muted-foreground">
                  {review.done} of {review.total} reviewed today
                </p>
              </div>
              <Button asChild>
                <Link href="/practice">Continue review</Link>
              </Button>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <p className="type-overline text-muted-foreground">Needs attention</p>
              <ul className="space-y-2">
                {weakAreas.map((area) => (
                  <li key={area.category} className="rounded-md bg-card/70 px-3 py-2">
                    <CategoryBadge
                      category={area.category}
                      variant="dot"
                      className="text-foreground"
                    >
                      {area.label}
                    </CategoryBadge>
                    <p className="mt-0.5 type-caption text-muted-foreground">{area.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section aria-labelledby="continue-learning">
            <SectionHeading
              id="continue-learning"
              title="Continue learning"
              link={{ href: "/finder", label: "Find more" }}
            />
            <div className="rounded-lg border border-border bg-card p-1">
              {continueLearning.map(({ slug, context }) => {
                const item = requireLanguageItem(slug);
                return (
                  <LanguageRow
                    key={slug}
                    href={`/language/${slug}`}
                    term={item.term}
                    category={item.category}
                    context={context}
                    status={item.status}
                  />
                );
              })}
            </div>
          </section>

          <section
            aria-labelledby="recent-mistakes-title"
            id="recent-mistakes"
            className="scroll-mt-16"
          >
            <SectionHeading id="recent-mistakes-title" title="Recent mistakes" />
            <p className="-mt-1 mb-3 type-body text-muted-foreground">
              Each one is a correction waiting to stick — fix it once in context and it comes back
              for review.
            </p>
            <div className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
              {mistakes.map((m) => (
                <MistakeRow key={m.wrong} {...m} />
              ))}
            </div>
          </section>
        </div>

        <aside
          aria-labelledby="quick-actions"
          className="space-y-3 lg:sticky lg:top-16 lg:self-start"
        >
          <h2 id="quick-actions" className="type-subheading text-foreground">
            Quick actions
          </h2>
          <nav aria-label="Quick actions" className="rounded-lg border border-border bg-card p-1">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-120 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <action.icon aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block type-label text-foreground">{action.label}</span>
                  <span className="block type-caption text-muted-foreground">{action.detail}</span>
                </span>
              </Link>
            ))}
            <SavedLanguageLink count={savedCount} />
          </nav>
        </aside>
      </div>
    </PageContainer>
  );
}
