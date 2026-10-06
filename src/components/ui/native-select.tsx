import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "cn";

/**
 * A styled native <select>: matches Input (40px / 44px, flat, 3:1 edge) and keeps the platform's
 * accessible, mobile-friendly picker. Use for short fixed lists in forms.
 */
function NativeSelect({
  className,
  size = "default",
  children,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "default" | "lg" }) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "w-full min-w-0 cursor-pointer appearance-none rounded-md border border-input bg-card pr-9 pl-3 text-base text-foreground transition-[color,border-color,box-shadow] duration-120 ease-standard outline-none hover:border-foreground/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-disabled-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
          size === "lg" ? "h-control-lg" : "h-control-input",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle-foreground"
      />
    </div>
  );
}

export { NativeSelect };
