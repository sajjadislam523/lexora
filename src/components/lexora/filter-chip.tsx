import { cn } from "@/lib/utils";

import { LANGUAGE_CATEGORIES, type LanguageCategory } from "./language-category";

type FilterChipProps = Omit<React.ComponentProps<"button">, "type"> & {
  pressed: boolean;
  /** Optional category: shows its colour dot so the chip links to result badges. */
  category?: LanguageCategory;
  count?: number;
};

/**
 * Toggleable filter pill (e.g. Finder category filters). One of the few pill shapes in Lexora.
 * Inactive: hairline outline. Active: charcoal fill. State is exposed with aria-pressed.
 */
export function FilterChip({
  pressed,
  category,
  count,
  className,
  children,
  ...props
}: FilterChipProps) {
  const config = category ? LANGUAGE_CATEGORIES[category] : null;

  return (
    <button
      type="button"
      data-slot="filter-chip"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-control-sm shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 type-label whitespace-nowrap transition-[color,background-color,border-color] duration-120 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:text-disabled-foreground max-sm:h-8",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
        className,
      )}
      {...props}
    >
      {config ? (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", pressed ? config.soft : config.dot)}
        />
      ) : null}
      {children ?? config?.label}
      {count !== undefined ? (
        <span
          className={cn(
            "font-mono text-2xs tabular-nums",
            pressed ? "text-primary-foreground/75" : "text-subtle-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
