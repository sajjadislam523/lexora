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
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 py-12 first:pt-0">
      <p className="type-overline text-subtle-foreground">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-1.5 type-title text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-reading type-reading text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-8 space-y-10">{children}</div>
    </section>
  );
}

export function Specimen({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="type-subheading text-foreground">{title}</h3>
        {note ? <p className="type-caption text-subtle-foreground">{note}</p> : null}
      </div>
      <div className={cn("rounded-lg border border-border bg-card p-5 sm:p-6", className)}>
        {children}
      </div>
    </div>
  );
}
