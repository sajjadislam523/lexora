import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";

import { FoundationsSection } from "./_sections/foundations";
import { PatternsSection } from "./_sections/patterns";
import { PrimitivesSection } from "./_sections/primitives";
import { StatesSection } from "./_sections/states";

export const metadata: Metadata = {
  title: "Design system",
  description: "Lexora design tokens, primitives and patterns.",
};

const SECTIONS = [
  { id: "foundations", label: "Tokens" },
  { id: "primitives", label: "Primitives" },
  { id: "patterns", label: "Lexora patterns" },
  { id: "states", label: "States & feedback" },
];

/**
 * Visual playground for the design system. A development surface, not a product page:
 * everything here is static sample content. The spec lives in docs/DESIGN.md.
 */
export default function DesignSystemPage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-page items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="type-subheading text-foreground hover:text-ink">
            Lexora
          </Link>
          <span className="text-subtle-foreground" aria-hidden>
            /
          </span>
          <span className="type-label text-muted-foreground">Design system</span>
          <Badge variant="outline" className="ml-auto">
            Prototype · static
          </Badge>
        </div>
      </header>

      <div className="mx-auto flex max-w-page gap-12 px-4 py-10 sm:px-6 sm:py-14">
        <nav aria-label="Design system sections" className="hidden w-44 shrink-0 lg:block">
          <ul className="sticky top-24 space-y-0.5">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-2 py-1.5 type-label text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          <div className="border-b border-border pb-10">
            <p className="type-overline text-subtle-foreground">Phase 0 · Foundation</p>
            <h1 className="mt-2 type-title text-foreground sm:type-display">
              Lexora design system
            </h1>
            <p className="mt-3 max-w-reading type-reading text-muted-foreground">
              Warm, editorial and calm. This page renders the real tokens and components so changes
              can be reviewed in one place. The written specification is{" "}
              <code className="rounded-xs bg-muted px-1 py-0.5 type-mono text-foreground">
                docs/DESIGN.md
              </code>
              .
            </p>
          </div>

          <FoundationsSection />
          <PrimitivesSection />
          <PatternsSection />
          <StatesSection />
        </main>
      </div>
    </div>
  );
}
