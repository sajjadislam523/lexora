"use client";

import { useSyncExternalStore } from "react";

/**
 * The last search results page this tab showed (`/explore?q=…` or `/finder?q=…`), so a language
 * page's "Back to search" returns to those results. A per-tab convenience in sessionStorage —
 * never learner data — that is simply absent when storage is unavailable.
 */
const KEY = "lexora:last-search";
const listeners = new Set<() => void>();

export function rememberSearch(url: string) {
  try {
    window.sessionStorage.setItem(KEY, url);
  } catch {
    // Storage unavailable (private mode): "Back to search" opens search itself.
  }
  for (const listener of listeners) listener();
}

/** The remembered URL, if it is one of Lexora's own search pages (it becomes a link's href). */
export function readLastSearch() {
  try {
    const url = window.sessionStorage.getItem(KEY);
    return url && /^\/(explore|finder)\?q=/.test(url) ? url : null;
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The remembered results URL, or null (always null while rendering on the server). */
export function useLastSearch() {
  return useSyncExternalStore(subscribe, readLastSearch, () => null);
}
