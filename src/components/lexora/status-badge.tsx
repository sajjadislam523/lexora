import { cn } from "@/lib/utils";

const STATUSES = {
  new: { label: "New", className: "bg-ink-soft text-ink-strong", dot: "bg-ink" },
  learning: { label: "Learning", className: "bg-warning-soft text-warning", dot: "bg-warning" },
  due: {
    label: "Due",
    className: "bg-primary text-primary-foreground",
    dot: "bg-primary-foreground",
  },
  mastered: { label: "Mastered", className: "bg-success-soft text-success", dot: "bg-success" },
} as const;

export type LearningStatus = keyof typeof STATUSES;

/**
 * Learning status of an item: pill-shaped so it never reads as a category tag (which is rectangular).
 */
export function StatusBadge({
  status,
  className,
  ...props
}: React.ComponentProps<"span"> & { status: LearningStatus }) {
  const config = STATUSES[status];

  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full px-2 type-micro whitespace-nowrap",
        config.className,
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
