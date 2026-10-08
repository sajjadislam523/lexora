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

/**
 * After a submit fails validation, moves focus to the first invalid field, so keyboard and
 * screen-reader users land on the problem and hear its error (wired by `fieldAria`).
 * Runs after React has rendered the errors.
 */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  // A task, not an animation frame: frames don't run in a background tab.
  setTimeout(() => form?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
}
