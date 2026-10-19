import {
  Check,
  CircleCheck,
  CircleHelp,
  CircleMinus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The five context-fit verdicts the search engine gives (GapVerdict in
 * src/language/search/gap/verdicts.ts), kept as a plain union so this shared component doesn't
 * depend on the engine. Categorical, never a score.
 */
export type Verdict = "fits" | "likely_fits" | "depends" | "unlikely" | "not_supported";

/** What each verdict means, in the learner's words. */
export const VERDICTS: Record<
  Verdict,
  { label: string; description: string; icon: LucideIcon; className: string }
> = {
  fits: {
    label: "Fits",
    description: "Lexora’s language patterns support this use in your sentence.",
    icon: Check,
    className: "bg-success-soft text-success",
  },
  likely_fits: {
    label: "Likely fits",
    description: "The pattern matches, but Lexora can’t check every word around the gap.",
    icon: CircleCheck,
    className: "bg-card text-success ring-1 ring-success/40 ring-inset",
  },
  depends: {
    label: "Depends",
    description:
      "This can work, but your sentence doesn’t give Lexora enough to decide — it depends on what you mean or what comes next.",
    icon: CircleHelp,
    className: "bg-muted text-muted-foreground",
  },
  unlikely: {
    label: "Unlikely",
    description:
      "This goes against a pattern Lexora knows, or recreates a common mistake it has recorded.",
    icon: TriangleAlert,
    className: "bg-warning-soft text-warning",
  },
  not_supported: {
    label: "Not supported",
    description:
      "Lexora has no pattern for this use in your sentence. That isn’t the same as wrong — it just can’t vouch for it.",
    icon: CircleMinus,
    className: "bg-card text-subtle-foreground ring-1 ring-border-strong ring-inset",
  },
};

/**
 * How well a choice fits the learner's sentence, by Lexora's authored patterns. A judgement, so it
 * is pill-shaped like the other status badges (DESIGN.md §9.6); the label and icon carry the
 * meaning, never colour alone.
 */
export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const { label, icon: Icon, className: tone } = VERDICTS[verdict];
  return (
    <span
      data-slot="verdict-badge"
      data-verdict={verdict}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 type-micro whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0" />
      {label}
    </span>
  );
}
