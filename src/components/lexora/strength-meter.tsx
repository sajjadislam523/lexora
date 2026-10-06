import { cn } from "@/lib/utils";

const LABELS = { 1: "Moderate", 2: "High", 3: "Very high" } as const;

type StrengthMeterProps = {
  strength: 1 | 2 | 3;
  /** Show the text label next to the bars. The accessible name is always present. */
  showLabel?: boolean;
  className?: string;
};

/** How strong an expression is compared with its plain alternative (e.g. "important"). */
export function StrengthMeter({ strength, showLabel = true, className }: StrengthMeterProps) {
  const label = `Strength: ${LABELS[strength]}`;

  return (
    <span
      data-slot="strength-meter"
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span aria-hidden className="flex items-center gap-0.5">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1.5 w-3 rounded-full",
              step <= strength ? "bg-ink" : "bg-border-strong",
            )}
          />
        ))}
      </span>
      {showLabel ? (
        <span aria-hidden className="type-caption text-muted-foreground">
          {label}
        </span>
      ) : null}
    </span>
  );
}
