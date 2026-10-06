"use client";

import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavItem } from "@/components/lexora/nav-item";
import { SearchTrigger } from "@/components/lexora/search-trigger";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { PRIMARY_NAV, SECONDARY_NAV, isActive } from "./navigation";
import { useShell } from "./shell-provider";

function LogoMark() {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary type-micro font-semibold text-primary-foreground"
    >
      L
    </span>
  );
}

type SidebarBodyProps = {
  collapsed: boolean;
  /** Desktop only: show the collapse / expand control. */
  collapsible: boolean;
  onNavigate?: () => void;
};

/** Sidebar contents, shared by the desktop rail and the mobile sheet. */
function SidebarBody({ collapsed, collapsible, onNavigate }: SidebarBodyProps) {
  const pathname = usePathname();
  const { toggleCollapsed, setPaletteOpen } = useShell();

  const openPalette = () => {
    onNavigate?.();
    setPaletteOpen(true);
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-12 shrink-0 items-center gap-2 px-3",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? null : (
          <Link
            href="/home"
            onClick={onNavigate}
            className="flex min-w-0 items-center gap-2 rounded-sm px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogoMark />
            <span className="truncate type-label text-foreground">Lexora</span>
          </Link>
        )}
        {collapsible ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
                className={cn(!collapsed && "ml-auto")}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand" : "Collapse"} sidebar · ⌘\
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div className={cn("px-3", collapsed && "flex justify-center px-0")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={openPalette}
                aria-label="Open command palette"
              >
                <Search />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Search · ⌘K</TooltipContent>
          </Tooltip>
        ) : (
          <SearchTrigger placeholder="Search or jump…" onClick={openPalette} />
        )}
      </div>

      <nav
        aria-label="Primary"
        className={cn("mt-4 flex-1 space-y-0.5 overflow-y-auto px-3", collapsed && "px-2")}
      >
        {PRIMARY_NAV.map((entry) => (
          <NavItem
            key={entry.id}
            href={entry.href}
            label={entry.label}
            icon={entry.icon}
            active={isActive(pathname, entry.href)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <nav
        aria-label="Secondary"
        className={cn("shrink-0 space-y-0.5 border-t border-border px-3 py-3", collapsed && "px-2")}
      >
        {SECONDARY_NAV.map((entry) => (
          <NavItem
            key={entry.id}
            href={entry.href}
            label={entry.label}
            icon={entry.icon}
            active={isActive(pathname, entry.href)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </div>
  );
}

/** Persistent sidebar from the lg breakpoint; collapses to a 56px icon rail. */
export function DesktopSidebar() {
  const { collapsed } = useShell();

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-sidebar transition-[width] duration-180 ease-standard lg:block",
        collapsed ? "w-14" : "w-sidebar",
      )}
    >
      <SidebarBody collapsed={collapsed} collapsible />
    </aside>
  );
}

/** Below lg the sidebar lives in a left sheet, opened from the top bar. */
export function MobileSidebar() {
  const { mobileNavOpen, setMobileNavOpen } = useShell();

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="left" className="w-sidebar gap-0 bg-sidebar p-0 sm:max-w-none">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Lexora pages</SheetDescription>
        <SidebarBody
          collapsed={false}
          collapsible={false}
          onNavigate={() => setMobileNavOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
