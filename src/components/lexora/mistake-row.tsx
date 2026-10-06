import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MistakeRowProps = {
  wrong: string;
  right: string;
  /** Kind of mistake: Preposition, Collocation, Repetition… */
  type?: string;
  why: string;
  action?: { label: string; href: string };
  className?: string;
};

/**
 * A mistake shown as a correction, not a failure: the old form struck through quietly, the
 * better form in full colour, one line of why, and a next step.
 */
export function MistakeRow({ wrong, right, type, why, action, className }: MistakeRowProps) {
  return (
    <div
      data-slot="mistake-row"
      className={cn(
        "flex flex-col gap-3 px-3 py-3.5 sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {type ? <p className="type-overline text-subtle-foreground">{type}</p> : null}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <s className="type-term-sm font-normal text-muted-foreground decoration-subtle-foreground">
            <span className="sr-only">Instead of </span>
            {wrong}
          </s>
          <ArrowRight aria-hidden className="size-3.5 shrink-0 text-subtle-foreground" />
          <span className="type-term-sm text-foreground">
            <span className="sr-only">use </span>
            {right}
          </span>
        </p>
        <p className="type-caption text-muted-foreground">{why}</p>
      </div>
      {action ? (
        <Button asChild variant="outline" size="sm" className="self-start sm:self-center">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
