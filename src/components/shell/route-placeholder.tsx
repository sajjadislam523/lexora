import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/lexora/page-header";
import { Badge } from "@/components/ui/badge";

import { getNavEntry } from "./navigation";
import { PageContainer } from "./page-container";

/**
 * Honest stand-in for a page that is not built yet: what it will do, which phase delivers it,
 * and where to go meanwhile. Shares the page frame and header of the built screens.
 */
export function RoutePlaceholder({ id }: { id: string }) {
  const entry = getNavEntry(id);
  const Icon = entry.icon;

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        eyebrow={<Badge variant="outline">Not built yet</Badge>}
        title={entry.label}
        description={entry.description}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="planned-title"
          className="rounded-lg border border-dashed border-border-strong p-5 sm:p-6 lg:col-span-2"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon aria-hidden className="size-4.5" />
            </span>
            <div className="min-w-0">
              <h2 id="planned-title" className="type-subheading text-foreground">
                What this screen will do
              </h2>
              <p className="type-caption text-muted-foreground">{entry.status}</p>
            </div>
          </div>
          {entry.plans ? (
            <ul className="mt-5 space-y-2.5">
              {entry.plans.map((plan) => (
                <li key={plan} className="flex gap-2.5 type-body text-foreground">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
                  {plan}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {entry.seeAlso && entry.seeAlso.length > 0 ? (
          <nav aria-labelledby="see-also-title" className="space-y-3">
            <h2 id="see-also-title" className="type-subheading text-foreground">
              Meanwhile
            </h2>
            <ul className="rounded-lg border border-border bg-card p-1">
              {entry.seeAlso.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-3 type-label text-foreground transition-colors duration-120 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {link.label}
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </PageContainer>
  );
}
