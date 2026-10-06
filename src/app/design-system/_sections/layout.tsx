import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { Section, Specimen } from "./section";

const SPACING = [
  { step: "1", px: 4, className: "w-1" },
  { step: "2", px: 8, className: "w-2" },
  { step: "3", px: 12, className: "w-3" },
  { step: "4", px: 16, className: "w-4" },
  { step: "5", px: 20, className: "w-5" },
  { step: "6", px: 24, className: "w-6" },
  { step: "8", px: 32, className: "w-8" },
  { step: "10", px: 40, className: "w-10" },
  { step: "12", px: 48, className: "w-12" },
  { step: "16", px: 64, className: "w-16" },
];

const RHYTHM = [
  { token: "section-sm", px: 48, className: "h-section-sm", use: "Between groups in a page" },
  { token: "section", px: 64, className: "h-section", use: "Between page sections" },
  { token: "section-lg", px: 96, className: "h-section-lg", use: "Onboarding / marketing bands" },
];

const RADII = [
  { name: "xs", px: 4, className: "rounded-xs", use: "Tags, kbd, marks" },
  { name: "sm", px: 6, className: "rounded-sm", use: "Nav rows, small controls" },
  { name: "md", px: 8, className: "rounded-md", use: "Buttons, inputs, menus" },
  { name: "lg", px: 12, className: "rounded-lg", use: "Cards, tiles, panels" },
  { name: "xl", px: 16, className: "rounded-xl", use: "Dialogs, palette, hero search" },
  { name: "full", px: null, className: "rounded-full", use: "Filter chips, status, avatars" },
];

const ELEVATION = [
  { level: "0 · Flat", className: "border border-border", use: "Resting cards, tiles, inputs" },
  {
    level: "1 · Hover",
    className: "border border-border-strong shadow-sm",
    use: "Hovered card or tile",
  },
  {
    level: "2 · Float",
    className: "border border-border shadow-md",
    use: "Menus, tooltips, popovers",
  },
  {
    level: "3 · Overlay",
    className: "border border-border shadow-lg",
    use: "Dialogs, command palette",
  },
];

const MOTION = [
  { token: "duration-120", className: "duration-120", use: "Hover, press, colour" },
  { token: "duration-180", className: "duration-180", use: "Popovers, tabs, overlays" },
  { token: "duration-240", className: "duration-240", use: "Dialogs, side panels" },
];

export function LayoutSection() {
  return (
    <Section
      id="layout"
      eyebrow="Foundations"
      title="Space, density & shape"
      description="A 4px grid with an 8px rhythm, two control densities, a sober radius scale and an elevation model where shadow means lifted."
    >
      <div className="grid gap-12 lg:grid-cols-2">
        <Specimen title="Spacing" note="4px base; prefer the steps shown.">
          <ul className="space-y-2">
            {SPACING.map((space) => (
              <li key={space.step} className="flex items-center gap-4">
                <span className="w-8 type-mono text-subtle-foreground">{space.step}</span>
                <span aria-hidden className={cn("h-3 rounded-xs bg-ink/70", space.className)} />
                <span className="type-caption text-muted-foreground">{space.px}px</span>
              </li>
            ))}
          </ul>
        </Specimen>

        <Specimen
          title="Section rhythm"
          note="Vertical space between regions: py-section-sm, py-section…"
        >
          <ul className="flex items-end gap-6">
            {RHYTHM.map((r) => (
              <li key={r.token} className="flex flex-1 flex-col gap-2">
                <span aria-hidden className={cn("w-full rounded-xs bg-ink-soft", r.className)} />
                <span className="type-mono text-foreground">{r.token}</span>
                <span className="type-caption text-muted-foreground">
                  {r.px}px · {r.use}
                </span>
              </li>
            ))}
          </ul>
        </Specimen>
      </div>

      <Specimen
        title="Control heights"
        note="Compact chrome for the app, comfortable sizes for forms, mobile and primary actions."
      >
        <div className="space-y-5">
          {[
            {
              h: "24",
              token: "control-xs",
              node: (
                <Button size="xs" variant="outline">
                  Inline
                </Button>
              ),
            },
            {
              h: "28",
              token: "control-sm",
              node: (
                <Button size="sm" variant="outline">
                  Toolbar
                </Button>
              ),
            },
            {
              h: "30",
              token: "control-nav",
              node: (
                <span className="flex h-control-nav w-48 items-center gap-2.5 rounded-sm bg-accent px-2 type-label text-foreground">
                  <Search aria-hidden className="size-4 text-ink" /> Sidebar row
                </span>
              ),
            },
            { h: "36", token: "control-md", node: <Button>Default button</Button> },
            {
              h: "40",
              token: "control-input",
              node: (
                <Input
                  aria-label="Default input"
                  placeholder="Default input"
                  className="max-w-xs"
                />
              ),
            },
            { h: "44", token: "control-lg", node: <Button size="lg">Comfortable</Button> },
          ].map((row) => (
            <div key={row.token} className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="w-32 shrink-0">
                <span className="block type-mono text-foreground">{row.token}</span>
                <span className="type-caption text-subtle-foreground">{row.h}px</span>
              </span>
              {row.node}
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen title="Radius" note="Rectangular, never bubbly.">
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {RADII.map((radius) => (
            <li key={radius.name} className="space-y-2">
              <div
                aria-hidden
                className={cn("h-14 w-full border border-border-strong bg-muted", radius.className)}
              />
              <p className="type-label text-foreground">
                {radius.name}{" "}
                <span className="type-mono text-subtle-foreground">
                  {radius.px ? `${radius.px}px` : "pill"}
                </span>
              </p>
              <p className="type-caption text-muted-foreground">{radius.use}</p>
            </li>
          ))}
        </ul>
      </Specimen>

      <div className="grid gap-12 lg:grid-cols-2">
        <Specimen
          title="Elevation"
          note="Surfaces rest flat. Shadow means lifted."
          className="bg-background"
        >
          <ul className="grid grid-cols-2 gap-5">
            {ELEVATION.map((e) => (
              <li key={e.level} className="space-y-2">
                <div aria-hidden className={cn("h-16 rounded-lg bg-card", e.className)} />
                <p className="type-label text-foreground">{e.level}</p>
                <p className="type-caption text-muted-foreground">{e.use}</p>
              </li>
            ))}
          </ul>
        </Specimen>

        <Specimen title="Motion" note="One curve. Hover the bars. Reduced motion is respected.">
          <ul className="space-y-4">
            {MOTION.map((motion) => (
              <li key={motion.token} className="group/motion space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="type-mono text-foreground">{motion.token}</p>
                  <p className="type-caption text-muted-foreground">{motion.use}</p>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-2 w-1/6 rounded-full bg-ink transition-[width] ease-standard group-hover/motion:w-full",
                      motion.className,
                    )}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 type-mono text-subtle-foreground">
            ease-standard: cubic-bezier(0.2, 0, 0, 1)
          </p>
        </Specimen>
      </div>
    </Section>
  );
}
