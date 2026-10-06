import { cn } from "@/lib/utils";

const FITS = {
  best: { label: "Best fit", className: "bg-success-soft text-success" },
  natural: { label: "Natural", className: "bg-ink-soft text-ink-strong" },
  possible: { label: "Possible", className: "bg-warning-soft text-warning" },
  different: { label: "Different meaning", className: "bg-muted text-muted-foreground" },
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
