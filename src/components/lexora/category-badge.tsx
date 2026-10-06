import { cn } from "@/lib/utils";

import { LANGUAGE_CATEGORIES, type LanguageCategory } from "./language-category";

type CategoryBadgeProps = React.ComponentProps<"span"> & {
  category: LanguageCategory;
  /** `soft` (default) is a tinted chip; `dot` is a quieter inline label for dense lists. */
  variant?: "soft" | "dot";
};

/** Identifies the kind of language an item is. Color is never the only signal — the label is always present. */
export function CategoryBadge({
  category,
  variant = "soft",
  className,
  children,
  ...props
}: CategoryBadgeProps) {
  const config = LANGUAGE_CATEGORIES[category];

  if (variant === "dot") {
    return (
      <span
        data-slot="category-badge"
        className={cn(
          "inline-flex items-center gap-1.5 type-caption text-muted-foreground",
          className,
        )}
        {...props}
      >
        <span aria-hidden className={cn("size-1.5 rounded-full", config.dot)} />
        {children ?? config.label}
      </span>
    );
  }

  return (
    <span
      data-slot="category-badge"
      className={cn(
        "inline-flex h-5 items-center rounded-xs border px-1.5 type-micro whitespace-nowrap",
        config.badge,
        className,
      )}
      {...props}
    >
      {children ?? config.label}
    </span>
  );
}
