import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

import { Kbd } from "./kbd";

type SearchTriggerProps = Omit<React.ComponentProps<"button">, "type"> & {
  placeholder?: string;
};

/**
 * Recessed search pill for app chrome (sidebar, top bar). It is a button, not an input:
 * activating it opens the command palette, where the actual typing happens.
 */
export function SearchTrigger({
  placeholder = "Search language…",
  className,
  ...props
}: SearchTriggerProps) {
  return (
    <button
      type="button"
      data-slot="search-trigger"
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        "group/trigger flex h-control-md w-full cursor-pointer items-center gap-2 rounded-md border border-border-subtle bg-muted px-2.5 text-left type-body text-subtle-foreground transition-[color,background-color,border-color] duration-120 ease-standard outline-none hover:border-border hover:bg-accent hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{placeholder}</span>
      <span aria-hidden className="flex shrink-0 items-center gap-0.5">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
