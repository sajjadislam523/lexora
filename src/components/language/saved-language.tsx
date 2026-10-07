"use client";

/**
 * Saving language, for signed-in learners and visitors alike.
 *
 * The server decides who may save: every save is a request to /api/bank/items/[slug], which
 * authenticates the session cookie and ignores any client-supplied identity. A visitor (or an
 * expired session) gets the save gate instead — an invitation to create an account that returns
 * them to the same page and completes the save.
 *
 * Saved state is held in memory for this browser session; the language bank stores it from
 * Phase 5. Nothing user-specific is rendered on the server for public pages.
 */
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

import { SaveGateDialog, type SaveGateRequest } from "./save-gate-dialog";

export type Viewer = "unknown" | "anonymous" | "signed-in";

export type SaveTarget = { slug: string; term: string };

type SavedLanguage = {
  viewer: Viewer;
  isSaved: (slug: string) => boolean;
  toggle: (target: SaveTarget) => void;
  count: number;
};

const SavedLanguageContext = createContext<SavedLanguage | null>(null);

const PENDING_KEY = "lexora:pending-save";
const PENDING_TTL_MS = 30 * 60 * 1000;

function displayTerm(term: string) {
  return term.replace(/,$/, "");
}

function readPendingSave(): SaveTarget | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    window.sessionStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as SaveTarget & { at: number };
    if (typeof pending.slug !== "string" || typeof pending.term !== "string") return null;
    return Date.now() - pending.at < PENDING_TTL_MS ? pending : null;
  } catch {
    return null;
  }
}

function writePendingSave(target: SaveTarget) {
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...target, at: Date.now() }));
  } catch {
    // Storage can be unavailable (private mode); the visitor simply saves again after signing in.
  }
}

async function requestSave(slug: string, saved: boolean) {
  const response = await fetch(`/api/bank/items/${encodeURIComponent(slug)}`, {
    method: saved ? "PUT" : "DELETE",
    credentials: "same-origin",
  });
  return response.status;
}

export function SavedLanguageProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const viewer: Viewer = session.isPending ? "unknown" : session.data ? "signed-in" : "anonymous";

  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());
  const [gate, setGate] = useState<SaveGateRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const previousViewer = useRef<Viewer>("unknown");

  const mark = useCallback((slug: string, value: boolean) => {
    setSaved((current) => {
      if (current.has(slug) === value) return current;
      const next = new Set(current);
      if (value) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }, []);

  const openGate = useCallback((target: SaveTarget) => {
    setGate({ ...target, returnTo: `${window.location.pathname}${window.location.search}` });
  }, []);

  const toggle = useCallback(
    (target: SaveTarget) => {
      if (viewer === "anonymous") {
        openGate(target);
        return;
      }
      const value = !saved.has(target.slug);
      mark(target.slug, value); // optimistic; reverted if the server says no
      requestSave(target.slug, value)
        .then((status) => {
          if (status >= 200 && status < 300) return;
          mark(target.slug, !value);
          if (status === 401) openGate(target);
          else setNotice(`Couldn’t update “${displayTerm(target.term)}”. Please try again.`);
        })
        .catch(() => {
          mark(target.slug, !value);
          setNotice("You seem to be offline. Please try again.");
        });
    },
    [viewer, saved, mark, openGate],
  );

  // Viewer transitions: finish a save started before signing in; forget saves after signing out.
  useEffect(() => {
    const previous = previousViewer.current;
    previousViewer.current = viewer;
    if (viewer === "anonymous" && previous === "signed-in") setSaved(new Set());
    if (viewer !== "signed-in" || previous === "signed-in") return;

    const pending = readPendingSave();
    if (!pending) return;
    requestSave(pending.slug, true)
      .then((status) => {
        if (status < 200 || status >= 300) return;
        mark(pending.slug, true);
        setNotice(`Saved “${displayTerm(pending.term)}” to your language bank.`);
      })
      .catch(() => undefined);
  }, [viewer, mark]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const value = useMemo(
    () => ({ viewer, isSaved: (slug: string) => saved.has(slug), toggle, count: saved.size }),
    [viewer, saved, toggle],
  );

  return (
    <SavedLanguageContext value={value}>
      {children}
      <SaveGateDialog
        request={gate}
        onOpenChange={(open) => !open && setGate(null)}
        onContinue={writePendingSave}
      />
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      >
        {notice ? (
          <p className="pointer-events-auto max-w-md rounded-md border border-border bg-popover px-4 py-3 type-body text-popover-foreground shadow-md">
            {notice}
          </p>
        ) : null}
      </div>
    </SavedLanguageContext>
  );
}

export function useSavedLanguage() {
  const context = use(SavedLanguageContext);
  if (!context) throw new Error("useSavedLanguage must be used inside <SavedLanguageProvider>");
  return context;
}

/** Whether the person viewing is signed in. "unknown" until the session check resolves. */
export function useViewer() {
  return useSavedLanguage().viewer;
}
