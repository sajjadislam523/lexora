import { cn } from "@/lib/utils";

type ProgressTrackProps = {
  value: number;
  max: number;
  /** Accessible name, e.g. "Today's review". */
  label: string;
  className?: string;
  /** Classes for the unfilled track, e.g. on a tinted panel. */
  trackClassName?: string;
};

/** A thin, quiet progress line. Not a score bar — no percentages or rewards. */
export function ProgressTrack({
  value,
  max,
  label,
  className,
  trackClassName,
}: ProgressTrackProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${max}`}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-muted", trackClassName, className)}
    >
      <div
        className="h-full rounded-full bg-ink transition-[width] duration-240 ease-standard"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
