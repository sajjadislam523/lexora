import { BookMarked, Lightbulb, Search } from "lucide-react";

import { SaveableResultCard } from "@/components/language/saveable-result-card";
import { AccountCta } from "@/features/discovery/account-cta";
import { ExampleLinks } from "@/features/discovery/example-links";
import { HeroSearch } from "@/features/discovery/hero-search";
import { ContextTool } from "@/features/finder/context-tool";
import { FitGuide } from "@/features/finder/fit-guide";
import { languageSearch } from "@/language";

const STEPS = [
  {
    icon: Search,
    title: "Describe what you want to say",
    body: "Type a word, a phrase or the idea itself — “alternative to however”, “preposition after responsible”.",
  },
  {
    icon: Lightbulb,
    title: "See how it’s really used",
    body: "Meaning, patterns, collocations, examples for writing and speaking, and the mistakes to avoid.",
  },
  {
    icon: BookMarked,
    title: "Save it and practise",
    body: "With a free account, keep the language you find and practise it until it comes naturally.",
  },
];

function SectionHeader({ id, title, children }: { id: string; title: string; children: string }) {
  return (
    <div className="max-w-2xl space-y-2">
      <h2 id={id} className="type-title text-foreground">
        {title}
      </h2>
      <p className="type-reading text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * The public landing page. It leads with the product itself — a working search and real
 * results — and asks for an account only when someone wants to keep what they found.
 */
export default function LandingPage() {
  const showcase = languageSearch.search("better word for important");
  const preview = showcase?.kind === "match" ? showcase : null;

  return (
    <>
      <section aria-labelledby="hero-title" className="px-4 pt-16 pb-14 sm:px-6 sm:pt-24 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="type-overline text-subtle-foreground">English for IELTS Academic</p>
          <h1 id="hero-title" className="mt-3 type-display text-foreground">
            Find the English you mean.
          </h1>
          <p className="mt-4 max-w-2xl type-reading text-muted-foreground">
            Search for the word, phrase, preposition, collocation, or expression you need — and
            learn how to use it naturally.
          </p>
          <div className="mt-8 space-y-4">
            <HeroSearch />
            <ExampleLinks />
          </div>
        </div>
      </section>

      {preview ? (
        <section
          aria-labelledby="showcase-title"
          className="border-t border-border px-4 py-14 sm:px-6 sm:py-20 lg:px-10"
        >
          <div className="mx-auto max-w-page space-y-8">
            <SectionHeader id="showcase-title" title="Not just a synonym — the right one">
              Search “better word for important” and Lexora shows which alternative fits, when to
              use it, and how it combines with other words.
            </SectionHeader>
            <div className="grid gap-6 lg:grid-cols-3">
              {preview.guide ? (
                <aside className="lg:sticky lg:top-20 lg:self-start">
                  <FitGuide guide={preview.guide} />
                </aside>
              ) : null}
              <div className="grid gap-4 lg:col-span-2">
                {preview.items.slice(0, 2).map((item) => (
                  <SaveableResultCard key={item.slug} item={item} />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="how-it-works"
        aria-labelledby="how-title"
        className="scroll-mt-14 border-t border-border bg-sidebar px-4 py-14 sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="mx-auto max-w-page space-y-10">
          <SectionHeader id="how-title" title="How it works">
            Lexora is built around the moment you’re writing or speaking and can’t find the right
            words.
          </SectionHeader>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-lg border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-md bg-muted text-ink">
                    <step.icon aria-hidden className="size-4" />
                  </span>
                  <span className="type-mono text-subtle-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-4 type-subheading text-foreground">{step.title}</h3>
                <p className="mt-1.5 type-body text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="context-title"
        className="border-t border-border px-4 py-14 sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="mx-auto grid max-w-page items-start gap-8 lg:grid-cols-2 lg:gap-12">
          <SectionHeader id="context-title" title="Choose the word that fits the sentence">
            The right word depends on the sentence around it. Pick a verb and Lexora explains how
            well it fits — including the preposition it brings with it.
          </SectionHeader>
          <ContextTool />
        </div>
      </section>

      <section
        aria-labelledby="cta-title"
        className="border-t border-border px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="mx-auto max-w-xl space-y-6">
          <div className="space-y-2">
            <h2 id="cta-title" className="type-title text-foreground">
              Keep the language you find
            </h2>
            <p className="type-reading text-muted-foreground">
              A free account saves language to your own bank, brings it back for practice, and shows
              how your recall is growing.
            </p>
          </div>
          <AccountCta />
        </div>
      </section>
    </>
  );
}
