"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Reads a CSS custom property at runtime so the playground never drifts from tokens.css. */
export function TokenValue({ name }: { name: string }) {
  const value = useSyncExternalStore(
    subscribe,
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => null,
  );

  return <span className="type-mono text-subtle-foreground">{value ?? "…"}</span>;
}
