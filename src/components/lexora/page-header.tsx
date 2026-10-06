import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** Top of every page: one serif title, an optional line of context, actions on the right. */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? <p className="type-overline text-subtle-foreground">{eyebrow}</p> : null}
        <h1 className="type-title text-foreground sm:type-display">{title}</h1>
        {description ? (
          <p className="max-w-reading type-reading text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
