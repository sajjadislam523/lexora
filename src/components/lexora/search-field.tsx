import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

type SearchFieldProps = Omit<React.ComponentProps<"input">, "size"> & {
  /** Accessible name. Rendered visually hidden; the placeholder is not a label. */
  label: string;
  /** `lg` is the Language Finder hero field; `md` is for in-page filtering. */
  size?: "md" | "lg";
  /** Optional trailing hint, typically a shortcut such as <Kbd>/</Kbd>. */
  hint?: React.ReactNode;
};

/**
 * The search input. Presentational only — it owns no query state and performs no search.
 * Wire it to the Language Finder in Phase 4.
 */
export function SearchField({
  label,
  size = "md",
  hint,
  className,
  id,
  ...props
}: SearchFieldProps) {
  const inputId = id ?? `search-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div
      data-slot="search-field"
      data-size={size}
      className={cn(
        "group/search relative flex w-full items-center rounded-md border border-input bg-card transition-[border-color,box-shadow] duration-120 ease-standard focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20 hover:border-foreground/50",
        size === "lg" ? "h-control-hero rounded-xl px-4 shadow-sm" : "h-control-input px-3",
        className,
      )}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden
        className={cn("shrink-0 text-subtle-foreground", size === "lg" ? "size-5" : "size-4")}
      />
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-subtle-foreground [&::-webkit-search-cancel-button]:hidden",
          size === "lg" ? "ml-3 text-lg" : "ml-2 text-base md:text-sm",
        )}
        {...props}
      />
      {hint ? <span className="ml-2 flex shrink-0 items-center gap-1">{hint}</span> : null}
    </div>
  );
}
