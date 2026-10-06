"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const subscribe = () => () => {};

function readVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Reads a CSS custom property at runtime so the playground never drifts from tokens.css. */
export function TokenValue({ name }: { name: string }) {
  const value = useSyncExternalStore(
    subscribe,
    () => readVar(name),
    () => null,
  );

  return <span className="type-mono text-subtle-foreground">{value ?? "…"}</span>;
}

function toRgb(hex: string): [number, number, number] | null {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Live WCAG contrast ratio between two colour tokens, with a pass/fail marker. */
export function ContrastRatio({ fg, bg, min = 4.5 }: { fg: string; bg: string; min?: number }) {
  const ratio = useSyncExternalStore(
    subscribe,
    () => {
      const a = toRgb(readVar(fg));
      const b = toRgb(readVar(bg));
      if (!a || !b) return null;
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    },
    () => null,
  );

  if (ratio === null) return <span className="type-mono text-subtle-foreground">…</span>;
  const pass = ratio >= min;

  return (
    <span
      className={cn("relative type-mono tabular-nums", pass ? "text-success" : "text-danger")}
      title={`${fg} on ${bg} — minimum ${min}:1`}
    >
      {ratio.toFixed(2)}:1 <span className="sr-only">{pass ? "passes" : "fails"}</span>
      <span aria-hidden>{pass ? "✓" : "✕"}</span>
    </span>
  );
}
