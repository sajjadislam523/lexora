"use client";

/**
 * Phase 1 prototype state — saved items live in memory for this browser session only.
 * Nothing is written anywhere; a reload clears it. The UI says so wherever saving appears.
 * Real persistence arrives with the language bank in Phase 5.
 */
import { createContext, use, useCallback, useMemo, useState } from "react";

type SavedItems = {
  isSaved: (slug: string) => boolean;
  toggle: (slug: string) => void;
  count: number;
};

const SavedItemsContext = createContext<SavedItems | null>(null);

export function SavedItemsProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Set<string>>(() => new Set(["significant"]));

  const toggle = useCallback((slug: string) => {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ isSaved: (slug: string) => saved.has(slug), toggle, count: saved.size }),
    [saved, toggle],
  );

  return <SavedItemsContext value={value}>{children}</SavedItemsContext>;
}

export function useSavedItems() {
  const context = use(SavedItemsContext);
  if (!context) throw new Error("useSavedItems must be used inside <SavedItemsProvider>");
  return context;
}
