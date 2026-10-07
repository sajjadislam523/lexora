import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Label, control, hint and error with the ARIA wiring described in DESIGN.md §9.2. */
export function FormField({ id, label, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="type-label text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="type-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="type-caption text-subtle-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria props for a control inside FormField. */
export function fieldAria(id: string, error?: string, hint?: boolean) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}
