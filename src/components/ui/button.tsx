import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-clip-padding type-label whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-120 ease-standard outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Filled variants: disabled = recessed fill + disabled text (no opacity fade).
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/88 active:bg-primary/80 disabled:bg-muted disabled:text-disabled-foreground disabled:shadow-none",
        ink: "bg-ink text-ink-foreground shadow-xs hover:bg-ink-strong active:bg-ink-strong/90 disabled:bg-muted disabled:text-disabled-foreground disabled:shadow-none",
        outline:
          "border-border-strong bg-card text-foreground hover:border-input/60 hover:bg-accent active:bg-accent/70 disabled:border-border disabled:bg-transparent disabled:text-disabled-foreground aria-expanded:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent active:bg-accent/70 disabled:text-disabled-foreground aria-expanded:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/70 disabled:text-disabled-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
        destructive:
          "bg-danger-soft text-danger hover:bg-danger/15 focus-visible:ring-danger active:bg-danger/20 disabled:bg-muted disabled:text-disabled-foreground",
        link: "h-auto! px-0! text-ink underline-offset-4 hover:underline disabled:text-disabled-foreground",
      },
      size: {
        // Compact chrome → comfortable forms. Heights come from the control-* tokens.
        // The compact sizes (24–28px) grow an invisible 4px hit area on touch screens, so they
        // stay ≥32px to a finger without looking bigger (DESIGN.md §12).
        xs: "relative h-control-xs gap-1 rounded-sm px-2 type-micro has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "relative h-control-sm gap-1.5 rounded-sm px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        default:
          "h-control-md gap-2 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        lg: "h-control-lg gap-2 px-4.5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        "icon-xs": "relative size-control-xs rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "relative size-control-sm rounded-sm",
        icon: "size-control-md",
        "icon-lg": "size-control-lg",
      },
    },
    compoundVariants: [
      {
        size: ["xs", "sm", "icon-xs", "icon-sm"],
        className: "pointer-coarse:after:absolute pointer-coarse:after:-inset-1",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
