import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** Small trailing count, e.g. items due for review. */
  count?: number;
  /** Icon-only rail mode: the label becomes a tooltip and stays available to screen readers. */
  collapsed?: boolean;
  /** Called after the link is activated (e.g. to close the mobile navigation sheet). */
  onNavigate?: () => void;
  className?: string;
};

/** A sidebar navigation row. Compact, icon + label, with a quiet active state. */
export function NavItem({
  href,
  label,
  icon: Icon,
  active = false,
  count,
  collapsed = false,
  onNavigate,
  className,
}: NavItemProps) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group/nav flex h-control-nav items-center gap-2.5 rounded-sm px-2 type-label text-muted-foreground transition-colors duration-120 ease-standard outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent font-semibold text-foreground",
        collapsed && "justify-center px-0",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0 text-subtle-foreground group-hover/nav:text-foreground",
          active && "text-ink group-hover/nav:text-ink",
        )}
      />
      <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
      {count !== undefined && !collapsed ? (
        <span className="ml-auto font-mono text-2xs text-subtle-foreground tabular-nums">
          {count}
        </span>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
