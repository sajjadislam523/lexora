import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** Small trailing count, e.g. items due for review. */
  count?: number;
  className?: string;
};

/** A sidebar navigation row. Compact, icon + label, with a quiet active state. */
export function NavItem({
  href,
  label,
  icon: Icon,
  active = false,
  count,
  className,
}: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav flex h-control-nav items-center gap-2.5 rounded-sm px-2 type-label text-muted-foreground transition-colors duration-120 ease-standard outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent font-semibold text-foreground",
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
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span className="ml-auto font-mono text-2xs text-subtle-foreground tabular-nums">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
