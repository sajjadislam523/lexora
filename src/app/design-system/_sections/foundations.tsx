import { CategoryBadge } from "@/components/lexora/category-badge";
import { LANGUAGE_CATEGORIES, LANGUAGE_CATEGORY_KEYS } from "@/components/lexora/language-category";
import { cn } from "@/lib/utils";

import { Section, Specimen } from "./section";
import { TokenValue } from "./token-value";

type Swatch = { token: string; className: string; role: string };

const COLOR_GROUPS: { title: string; note: string; swatches: Swatch[] }[] = [
  {
    title: "Surfaces",
    note: "Warm, layered, low contrast between layers.",
    swatches: [
      { token: "background", className: "bg-background", role: "Canvas" },
      { token: "card", className: "bg-card", role: "Raised surface" },
      { token: "sidebar", className: "bg-sidebar", role: "Sidebar" },
      { token: "muted", className: "bg-muted", role: "Recessed / wells" },
      { token: "accent", className: "bg-accent", role: "Hover / selected" },
    ],
  },
  {
    title: "Text",
    note: "Three steps. All pass WCAG AA on every surface.",
    swatches: [
      { token: "foreground", className: "bg-foreground", role: "Primary text" },
      { token: "muted-foreground", className: "bg-muted-foreground", role: "Secondary text" },
      {
        token: "subtle-foreground",
        className: "bg-subtle-foreground",
        role: "Metadata, placeholders",
      },
    ],
  },
  {
    title: "Lines",
    note: "Borders separate; shadows rarely do.",
    swatches: [
      { token: "border", className: "bg-border", role: "Hairline" },
      { token: "border-strong", className: "bg-border-strong", role: "Emphasised hairline" },
      { token: "input", className: "bg-input", role: "Form control edge (3:1)" },
    ],
  },
  {
    title: "Brand",
    note: "Charcoal acts. Ink guides: links, focus, active state.",
    swatches: [
      { token: "primary", className: "bg-primary", role: "Primary action" },
      { token: "ink", className: "bg-ink", role: "Ink accent / focus" },
      { token: "ink-strong", className: "bg-ink-strong", role: "Ink text on ink-soft" },
      { token: "ink-soft", className: "bg-ink-soft", role: "Ink tint" },
    ],
  },
  {
    title: "Feedback",
    note: "Always paired with an icon and words.",
    swatches: [
      { token: "success", className: "bg-success", role: "Correct, mastered" },
      { token: "warning", className: "bg-warning", role: "Caution, review" },
      { token: "danger", className: "bg-danger", role: "Error, incorrect" },
      { token: "info", className: "bg-info", role: "Note" },
    ],
  },
];

const TYPE_ROLES = [
  { role: "type-display", sample: "Find the right English.", use: "Hero and landing titles" },
  { role: "type-title", sample: "Language Finder", use: "Page and section titles" },
  { role: "type-heading", sample: "Saved expressions", use: "Panel headings" },
  { role: "type-subheading", sample: "Common mistakes", use: "Group and card headings" },
  { role: "type-term", sample: "responsible for", use: "The language item itself" },
  {
    role: "type-example",
    sample: "Rising sea levels pose a serious threat to coastal cities.",
    use: "Example sentences",
  },
  {
    role: "type-reading",
    sample: "Use “In contrast” to introduce a clear difference.",
    use: "Explanations, long text",
  },
  {
    role: "type-body",
    sample: "Search vocabulary, prepositions, linkers and patterns.",
    use: "Interface default",
  },
  { role: "type-label", sample: "Register", use: "Labels, nav, buttons" },
  { role: "type-caption", sample: "Updated 2 days ago", use: "Metadata, hints" },
  { role: "type-overline", sample: "In writing", use: "Eyebrows (sparingly)" },
  { role: "type-mono", sample: "responsible for + noun / -ing", use: "Patterns, keys, counts" },
];

const SPACING = [
  { step: "1", px: 4, className: "w-1" },
  { step: "2", px: 8, className: "w-2" },
  { step: "3", px: 12, className: "w-3" },
  { step: "4", px: 16, className: "w-4" },
  { step: "6", px: 24, className: "w-6" },
  { step: "8", px: 32, className: "w-8" },
  { step: "12", px: 48, className: "w-12" },
  { step: "16", px: 64, className: "w-16" },
  { step: "24", px: 96, className: "w-24" },
];

const RADII = [
  { name: "xs", px: 3, className: "rounded-xs", use: "Kbd, highlights" },
  { name: "sm", px: 4, className: "rounded-sm", use: "Badges, chips" },
  { name: "md", px: 6, className: "rounded-md", use: "Buttons, inputs, nav" },
  { name: "lg", px: 8, className: "rounded-lg", use: "Cards, menus" },
  { name: "xl", px: 12, className: "rounded-xl", use: "Dialogs, hero search" },
];

const SHADOWS = [
  { name: "xs", className: "shadow-xs", use: "Cards, inputs, buttons" },
  { name: "sm", className: "shadow-sm", use: "Hovered cards" },
  { name: "md", className: "shadow-md", use: "Menus, tooltips" },
  { name: "lg", className: "shadow-lg", use: "Dialogs, palette" },
];

const MOTION = [
  { token: "--duration-fast", className: "duration-120", use: "Hover, press, colour" },
  { token: "--duration-base", className: "duration-180", use: "Popovers, tabs, reveals" },
  { token: "--duration-slow", className: "duration-240", use: "Dialogs, panels" },
];

export function FoundationsSection() {
  return (
    <Section
      id="foundations"
      eyebrow="Foundations"
      title="Tokens"
      description="Every visual value in Lexora comes from src/styles/tokens.css. Components use semantic utilities, never raw values."
    >
      {COLOR_GROUPS.map((group) => (
        <Specimen key={group.title} title={group.title} note={group.note}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {group.swatches.map((swatch) => (
              <li key={swatch.token} className="space-y-2">
                <div
                  className={cn("h-14 rounded-md border border-border", swatch.className)}
                  aria-hidden
                />
                <div className="space-y-0.5">
                  <p className="type-label text-foreground">{swatch.token}</p>
                  <p className="type-caption text-muted-foreground">{swatch.role}</p>
                  <TokenValue name={`--${swatch.token}`} />
                </div>
              </li>
            ))}
          </ul>
        </Specimen>
      ))}

      <Specimen
        title="Language categories"
        note="Colour identifies the kind of language. The label is always present."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LANGUAGE_CATEGORY_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="flex flex-col gap-1.5">
                <CategoryBadge category={key} />
                <CategoryBadge category={key} variant="dot" />
              </div>
              <span className="type-mono text-subtle-foreground">cat-{key}</span>
              <span className="sr-only">{LANGUAGE_CATEGORIES[key].label}</span>
            </li>
          ))}
        </ul>
      </Specimen>

      <Specimen
        title="Typography"
        note="Newsreader for the editorial voice, Inter for the interface, JetBrains Mono for structure."
        className="p-0 sm:p-0"
      >
        <ul className="divide-y divide-border">
          {TYPE_ROLES.map((type) => (
            <li
              key={type.role}
              className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6 sm:px-6"
            >
              <div className="shrink-0 sm:w-48">
                <p className="type-mono text-foreground">{type.role}</p>
                <p className="type-caption text-subtle-foreground">{type.use}</p>
              </div>
              <p className={cn("min-w-0 text-foreground", type.role)}>{type.sample}</p>
            </li>
          ))}
        </ul>
      </Specimen>

      <div className="grid gap-10 lg:grid-cols-2">
        <Specimen title="Spacing" note="4px base. Prefer the steps shown.">
          <ul className="space-y-2">
            {SPACING.map((space) => (
              <li key={space.step} className="flex items-center gap-4">
                <span className="w-8 type-mono text-subtle-foreground">{space.step}</span>
                <span className={cn("h-3 rounded-xs bg-ink/70", space.className)} aria-hidden />
                <span className="type-caption text-muted-foreground">{space.px}px</span>
              </li>
            ))}
          </ul>
        </Specimen>

        <Specimen title="Radius" note="Restrained. Pills only for avatars and toggles.">
          <ul className="grid grid-cols-3 gap-4 sm:grid-cols-5">
            {RADII.map((radius) => (
              <li key={radius.name} className="space-y-2">
                <div
                  className={cn("size-14 border border-border-strong bg-muted", radius.className)}
                  aria-hidden
                />
                <p className="type-label text-foreground">
                  {radius.name}{" "}
                  <span className="type-mono text-subtle-foreground">{radius.px}px</span>
                </p>
                <p className="type-caption text-muted-foreground">{radius.use}</p>
              </li>
            ))}
          </ul>
        </Specimen>

        <Specimen title="Elevation" note="Low and warm. Borders carry most separation.">
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {SHADOWS.map((shadow) => (
              <li key={shadow.name} className="space-y-2">
                <div
                  className={cn("h-16 rounded-lg border border-border bg-card", shadow.className)}
                  aria-hidden
                />
                <p className="type-label text-foreground">{shadow.name}</p>
                <p className="type-caption text-muted-foreground">{shadow.use}</p>
              </li>
            ))}
          </ul>
        </Specimen>

        <Specimen
          title="Motion"
          note="One easing curve. Hover the bars. Reduced motion is respected."
        >
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
