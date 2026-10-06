"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import type { SafeUser } from "@/server/auth/session";

type ShellState = {
  /** The signed-in user (safe fields only). */
  user: SafeUser;
  /** Desktop sidebar collapsed to an icon rail. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Mobile navigation sheet. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  /** Global command palette. */
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function useShell() {
  const context = use(ShellContext);
  if (!context) throw new Error("useShell must be used inside <ShellProvider>");
  return context;
}

/**
 * UI state for the application shell. Lives in the (app) layout, so it survives client-side
 * navigation between pages. Nothing is persisted yet.
 */
export function ShellProvider({ user, children }: { user: SafeUser; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleCollapsed = useCallback(() => setCollapsed((value) => !value), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      } else if (key === "\\") {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({
      user,
      collapsed,
      toggleCollapsed,
      mobileNavOpen,
      setMobileNavOpen,
      paletteOpen,
      setPaletteOpen,
    }),
    [user, collapsed, toggleCollapsed, mobileNavOpen, paletteOpen],
  );

  return <ShellContext value={value}>{children}</ShellContext>;
}
