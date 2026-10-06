import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";

import { ColorSection } from "./_sections/color";
import { ComponentsSection } from "./_sections/components";
import { CompositionSection } from "./_sections/composition";
import { LayoutSection } from "./_sections/layout";
import { PaletteProvider } from "./_sections/palette";
import { PrinciplesSection } from "./_sections/principles";
import { StatesSection } from "./_sections/states";
import { TypographySection } from "./_sections/typography";

export const metadata: Metadata = {
  title: "Design system",
  description: "Lexora design language: principles, tokens, components and states.",
};

const SECTIONS = [
  { id: "principles", label: "Principles" },
  { id: "colour", label: "Colour" },
  { id: "typography", label: "Typography" },
  { id: "layout", label: "Space & shape" },
  { id: "components", label: "Components" },
  { id: "states", label: "States" },
  { id: "composition", label: "Composition" },
];

/**
 * Visual review surface for the design system. A development page, not a product page:
 * all content is static sample data. The written specification is docs/DESIGN.md.
 */
export default function DesignSystemPage() {
  return (
    <PaletteProvider>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur-sm">
          <div className="mx-auto flex h-12 max-w-page items-center gap-3 px-4 sm:px-6">
            <Link href="/" className="type-label text-foreground hover:text-ink">
              Lexora
            </Link>
            <span className="text-subtle-foreground" aria-hidden>
              /
            </span>
            <span className="type-label text-muted-foreground">Design system</span>
            <Badge variant="outline" className="ml-auto">
              v0.2 · Prototype · static
            </Badge>
          </div>
          <nav
            aria-label="Design system sections (mobile)"
            className="border-t border-border-subtle lg:hidden"
          >
            <ul className="mx-auto no-scrollbar flex max-w-page gap-1 overflow-x-auto px-4 py-2 sm:px-6">
              {SECTIONS.map((section) => (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    className="block rounded-full px-3 py-1 type-caption text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <div className="mx-auto flex max-w-page gap-12 px-4 py-10 sm:px-6 lg:py-section">
          <nav aria-label="Design system sections" className="hidden w-40 shrink-0 lg:block">
            <ul className="sticky top-20 space-y-0.5">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex h-control-nav items-center rounded-sm px-2 type-label text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <main className="min-w-0 flex-1">
            <div className="mb-section-sm">
              <Badge variant="ink">Design language v0.2</Badge>
              <h1 className="mt-4 type-display text-foreground">Lexora design system</h1>
              <p className="mt-4 max-w-prose type-reading text-muted-foreground">
                Calm, warm and precise. Interface in Inter, language in Newsreader, colour only
                where it means something. This page renders the real tokens and components; the
                written specification is{" "}
                <code className="rounded-xs bg-muted px-1 py-0.5 type-mono text-foreground">
                  docs/DESIGN.md
                </code>
                .
              </p>
            </div>

            <PrinciplesSection />
            <ColorSection />
            <TypographySection />
            <LayoutSection />
            <ComponentsSection />
            <StatesSection />
            <CompositionSection />
          </main>
        </div>
      </div>
    </PaletteProvider>
  );
}
