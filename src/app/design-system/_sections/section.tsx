import { cn } from "@/lib/utils";

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 border-t border-border py-section-sm lg:py-section"
    >
      <p className="type-overline text-subtle-foreground">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 type-title text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-prose type-reading text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-10 space-y-12">{children}</div>
    </section>
  );
}

export function Specimen({
  title,
  note,
  children,
  className,
  wrapperClassName,
  bare = false,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
  /** Classes for the outer wrapper, e.g. grid placement. */
  wrapperClassName?: string;
  /** Render children directly on the canvas, without the white specimen frame. */
  bare?: boolean;
}) {
  return (
    <div className={wrapperClassName}>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="type-subheading text-foreground">{title}</h3>
        {note ? <p className="type-caption text-subtle-foreground">{note}</p> : null}
      </div>
      {bare ? (
        <div className={className}>{children}</div>
      ) : (
        <div className={cn("rounded-lg border border-border bg-card p-5 sm:p-6", className)}>
          {children}
        </div>
      )}
    </div>
  );
}
