import Link from "next/link";

import { CategoryBadge } from "@/components/lexora/category-badge";
import { HighlightedText } from "@/components/lexora/highlighted-text";

function LogoMark() {
  return (
    <span
      aria-hidden
      className="flex size-7 items-center justify-center rounded-sm bg-primary type-micro font-semibold text-primary-foreground"
    >
      L
    </span>
  );
}

/**
 * Authentication frame. Quiet and on-brand: the form on the canvas, and on wide screens a
 * sidebar-toned panel showing what Lexora is for — language in context.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-border bg-sidebar p-10 lg:flex">
        <Link
          href="/"
          className="flex w-fit items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogoMark />
          <span className="type-label text-foreground">Lexora</span>
        </Link>

        <figure className="max-w-md space-y-4">
          <CategoryBadge category="collocation" />
          <p className="type-term-display text-foreground">pose a threat</p>
          <blockquote className="border-l-2 border-border-strong pl-4 type-example text-foreground">
            <HighlightedText
              text="Rising sea levels pose a serious threat to coastal cities."
              highlight="pose a serious threat"
            />
          </blockquote>
          <figcaption className="type-caption text-muted-foreground">
            Lexora shows the language, the pattern and the context — so it’s there when you need it.
          </figcaption>
        </figure>

        <p className="type-body text-muted-foreground">
          Find the right English. Use it naturally. Remember it when it matters.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-10 flex w-fit items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <LogoMark />
            <span className="type-label text-foreground">Lexora</span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
