import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** Small label above the title. Pass a string for an overline, or a node (e.g. a Badge). */
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Top of every page: eyebrow → title → one muted line of context, actions on the right.
 * Titles are interface text (sans 600). Serif is reserved for language content.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-2">
        {typeof eyebrow === "string" ? (
          <p className="type-overline text-subtle-foreground">{eyebrow}</p>
        ) : (
          eyebrow
        )}
        <h1 className="type-title text-foreground">{title}</h1>
        {description ? (
          <p className="max-w-prose type-reading text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
      ) : null}
    </header>
  );
}
