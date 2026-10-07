import { cn } from "@/lib/utils";

/**
 * The context-gap verdicts the search engine gives (GapFit in src/language/search/types.ts).
 * Kept as a plain union here so this shared component doesn't depend on the engine.
 */
const FITS = {
  fits: { label: "Fits", className: "bg-success-soft text-success" },
  different_preposition: {
    label: "Different preposition",
    className: "bg-warning-soft text-warning",
  },
  unlikely: { label: "Doesn’t fit", className: "bg-muted text-muted-foreground" },
} as const;

export type Fit = keyof typeof FITS;

/** How well a choice fits a given sentence. A judgement, so it is pill-shaped like status. */
export function FitBadge({ fit, className }: { fit: Fit; className?: string }) {
  const config = FITS[fit];
  return (
    <span
      data-slot="fit-badge"
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 type-micro whitespace-nowrap",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
