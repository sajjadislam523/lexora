import { cn } from "@/lib/utils";

/** A keyboard key. Group several with a wrapping element: <span><Kbd>⌘</Kbd><Kbd>K</Kbd></span>. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border-strong bg-card px-1 font-mono text-2xs font-medium text-muted-foreground select-none",
        className,
      )}
      {...props}
    />
  );
}
