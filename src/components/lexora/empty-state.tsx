import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Usually one primary action. Empty states should point somewhere, not just apologise. */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-4.5" />
        </span>
      ) : null}
      <p className="type-subheading text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm type-body text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
