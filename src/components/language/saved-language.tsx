"use client";

/**
 * Saving language, for signed-in learners and visitors alike.
 *
 * Learners save a **sense** (`significant.notable`), not a word: each meaning is saved on its own.
 * PostgreSQL is the source of truth. Pages render the same for everyone, so saved state is asked
 * for in the browser — one request for the senses on screen (GET /api/bank/saved?senses=…) — and
 * every change is a request to /api/bank/saved/[senseId], which authenticates the session cookie
 * and ignores any client-supplied identity. The UI updates at once and is corrected if the
 * server says no; nothing here pretends to store anything.
 *
 * A visitor (or an expired session) gets the save gate: an invitation to create an account that
 * returns them to the same page and completes the save they started. That one intent is kept in
 * sessionStorage across the sign-in round trip; it is never treated as saved state.
 */
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

import { SaveGateDialog, type SaveGateRequest } from "./save-gate-dialog";

export type Viewer = "unknown" | "anonymous" | "signed-in";

/** What a save button saves: the sense, and how to name it to the learner. */
export type SaveTarget = { senseId: string; label: string };

type SavedLanguage = {
  viewer: Viewer;
  /** `true`/`false` once the server has answered; `undefined` while unknown or for visitors. */
  savedState: (senseId: string) => boolean | undefined;
  isPending: (senseId: string) => boolean;
  toggle: (target: SaveTarget) => void;
  /** Registers senses shown on screen, so their state is fetched (in one batched request). */
  watch: (senseIds: readonly string[]) => () => void;
};

const SavedLanguageContext = createContext<SavedLanguage | null>(null);

const PENDING_KEY = "lexora:pending-save";
const PENDING_TTL_MS = 30 * 60 * 1000;
/** The server answers for at most this many senses per request. */
const BATCH = 60;

function readPendingSave(): SaveTarget | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    window.sessionStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as SaveTarget & { at: number };
    if (typeof pending.senseId !== "string" || typeof pending.label !== "string") return null;
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

async function requestSave(senseId: string, saved: boolean) {
  const response = await fetch(`/api/bank/saved/${encodeURIComponent(senseId)}`, {
    method: saved ? "PUT" : "DELETE",
    credentials: "same-origin",
  });
  return response.status;
}

async function requestSavedAmong(senseIds: string[]) {
  const response = await fetch(
    `/api/bank/saved?senses=${senseIds.map(encodeURIComponent).join(",")}`,
    {
      credentials: "same-origin",
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(String(response.status));
  return ((await response.json()) as { saved: string[] }).saved;
}

export function SavedLanguageProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  // A failed session check (the server or database is down) is "unknown", not "signed out":
  // a learner must never be told to create an account because of an outage.
  const viewer: Viewer =
    session.isPending || session.error ? "unknown" : session.data ? "signed-in" : "anonymous";

  const [known, setKnown] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [gate, setGate] = useState<SaveGateRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [watched, setWatched] = useState<ReadonlyMap<string, number>>(() => new Map());
  const requested = useRef(new Set<string>());
  const previousViewer = useRef<Viewer>("unknown");

  const mark = useCallback((entries: [string, boolean][]) => {
    setKnown((current) => {
      const next = new Map(current);
      for (const [senseId, value] of entries) next.set(senseId, value);
      return next;
    });
  }, []);

  const setInFlight = useCallback((senseId: string, value: boolean) => {
    setPending((current) => {
      const next = new Set(current);
      if (value) next.add(senseId);
      else next.delete(senseId);
      return next;
    });
  }, []);

  const watch = useCallback((senseIds: readonly string[]) => {
    setWatched((current) => {
      const next = new Map(current);
      for (const id of senseIds) next.set(id, (next.get(id) ?? 0) + 1);
      return next;
    });
    return () =>
      setWatched((current) => {
        const next = new Map(current);
        for (const id of senseIds) {
          const count = (next.get(id) ?? 1) - 1;
          if (count <= 0) next.delete(id);
          else next.set(id, count);
        }
        return next;
      });
  }, []);

  // Fetch the saved state of watched senses we haven't asked about, in batches.
  useEffect(() => {
    if (viewer !== "signed-in") return;
    const missing = [...watched.keys()].filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    for (const id of missing) requested.current.add(id);
    for (let start = 0; start < missing.length; start += BATCH) {
      const batch = missing.slice(start, start + BATCH);
      requestSavedAmong(batch)
        .then((saved) => mark(batch.map((id) => [id, saved.includes(id)])))
        .catch(() => {
          // Unknown stays unknown; asking again on the next change of watched senses.
          for (const id of batch) requested.current.delete(id);
        });
    }
  }, [viewer, watched, mark]);

  const openGate = useCallback((target: SaveTarget) => {
    setGate({
      ...target,
      returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    });
  }, []);

  const toggle = useCallback(
    (target: SaveTarget) => {
      if (viewer === "anonymous") {
        openGate(target);
        return;
      }
      if (pending.has(target.senseId)) return;
      const previous = known.get(target.senseId);
      const value = !previous;
      mark([[target.senseId, value]]); // optimistic; corrected by the server's answer
      setInFlight(target.senseId, true);
      requestSave(target.senseId, value)
        .then((status) => {
          if (status >= 200 && status < 300) {
            setNotice(
              value
                ? `Saved “${target.label}” to your language bank.`
                : `Removed “${target.label}” from your language bank.`,
            );
            return;
          }
          mark([[target.senseId, previous ?? false]]);
          if (status === 401) openGate(target);
          else if (status === 404) setNotice(`“${target.label}” can no longer be saved.`);
          else setNotice(`Couldn’t update “${target.label}”. Please try again.`);
        })
        .catch(() => {
          mark([[target.senseId, previous ?? false]]);
          setNotice("You seem to be offline. Please try again.");
        })
        .finally(() => setInFlight(target.senseId, false));
    },
    [viewer, known, pending, mark, setInFlight, openGate],
  );

  // Viewer transitions: finish a save started before signing in; forget everything on sign-out.
  useEffect(() => {
    const previous = previousViewer.current;
    previousViewer.current = viewer;
    if (viewer === "anonymous" && previous === "signed-in") {
      setKnown(new Map());
      requested.current.clear();
    }
    if (viewer !== "signed-in" || previous === "signed-in") return;

    const started = readPendingSave();
    if (!started) return;
    requestSave(started.senseId, true)
      .then((status) => {
        if (status < 200 || status >= 300) return;
        mark([[started.senseId, true]]);
        setNotice(`Saved “${started.label}” to your language bank.`);
      })
      .catch(() => undefined);
  }, [viewer, mark]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const value = useMemo<SavedLanguage>(
    () => ({
      viewer,
      savedState: (senseId) => (viewer === "signed-in" ? known.get(senseId) : undefined),
      isPending: (senseId) => pending.has(senseId),
      toggle,
      watch,
    }),
    [viewer, known, pending, toggle, watch],
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

/** Saved state and the toggle for one sense on screen. */
export function useSavedSense(target: SaveTarget) {
  const { viewer, savedState, isPending, toggle, watch } = useSavedLanguage();
  const { senseId } = target;
  useEffect(() => watch([senseId]), [watch, senseId]);
  return {
    saved: savedState(senseId) ?? false,
    /** A learner's state is still on its way; a visitor's never comes (they have none). */
    loading: viewer !== "anonymous" && savedState(senseId) === undefined,
    pending: isPending(senseId),
    toggle: () => toggle(target),
  };
}

/** Whether the person viewing is signed in. "unknown" until the session check resolves. */
export function useViewer() {
  return useSavedLanguage().viewer;
}
