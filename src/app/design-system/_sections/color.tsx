import { CategoryBadge } from "@/components/lexora/category-badge";
import { LANGUAGE_CATEGORIES, LANGUAGE_CATEGORY_KEYS } from "@/components/lexora/language-category";
import { cn } from "@/lib/utils";

import { Section, Specimen } from "./section";
import { ContrastRatio, TokenValue } from "./token-value";

type Row = {
  token: string;
  swatch: string;
  role: string;
  /** Contrast check: [foreground var, background var, minimum]. */
  check?: [string, string, number?];
};

const GROUPS: { title: string; note: string; rows: Row[] }[] = [
  {
    title: "Surfaces",
    note: "Canvas → raised → recessed. Contrast shows primary text on each surface.",
    rows: [
      {
        token: "background",
        swatch: "bg-background",
        role: "Canvas — the page",
        check: ["--foreground", "--background", 7],
      },
      {
        token: "card",
        swatch: "bg-card",
        role: "Raised — cards, inputs, menus",
        check: ["--foreground", "--card", 7],
      },
      {
        token: "sidebar",
        swatch: "bg-sidebar",
        role: "Sidebar, a half-step below canvas",
        check: ["--foreground", "--sidebar", 7],
      },
      {
        token: "muted",
        swatch: "bg-muted",
        role: "Recessed — wells, search pill, patterns",
        check: ["--foreground", "--muted", 7],
      },
      {
        token: "accent",
        swatch: "bg-accent",
        role: "Hover and selected rows",
        check: ["--foreground", "--accent", 7],
      },
    ],
  },
  {
    title: "Text",
    note: "Three readable steps plus a disabled tone. Contrast measured on the canvas.",
    rows: [
      {
        token: "foreground",
        swatch: "bg-foreground",
        role: "Primary text, headings",
        check: ["--foreground", "--background", 7],
      },
      {
        token: "muted-foreground",
        swatch: "bg-muted-foreground",
        role: "Secondary text, descriptions",
        check: ["--muted-foreground", "--background"],
      },
      {
        token: "subtle-foreground",
        swatch: "bg-subtle-foreground",
        role: "Metadata, placeholders, eyebrows",
        check: ["--subtle-foreground", "--muted"],
      },
      {
        token: "disabled-foreground",
        swatch: "bg-disabled-foreground",
        role: "Disabled controls (exempt from minimums)",
      },
    ],
  },
  {
    title: "Lines",
    note: "Three hairline weights. Form edges meet 3:1 against the surface.",
    rows: [
      { token: "border-subtle", swatch: "bg-border-subtle", role: "Inner dividers, table rows" },
      { token: "border", swatch: "bg-border", role: "Card edges, section dividers" },
      {
        token: "border-strong",
        swatch: "bg-border-strong",
        role: "Outline buttons, table heads, hover edges",
      },
      {
        token: "input",
        swatch: "bg-input",
        role: "Form control edges",
        check: ["--input", "--card", 3],
      },
    ],
  },
  {
    title: "Brand & emphasis",
    note: "Charcoal acts. Ink guides. The highlighter marks.",
    rows: [
      {
        token: "primary",
        swatch: "bg-primary",
        role: "Primary action (charcoal)",
        check: ["--primary-foreground", "--primary", 7],
      },
      {
        token: "ink",
        swatch: "bg-ink",
        role: "Links, focus ring, active state",
        check: ["--ink", "--background"],
      },
      {
        token: "ink-soft",
        swatch: "bg-ink-soft",
        role: "Selection, “New” status",
        check: ["--ink-strong", "--ink-soft"],
      },
      {
        token: "highlight",
        swatch: "bg-highlight",
        role: "Highlighter — target terms, one emphasis panel",
        check: ["--highlight-foreground", "--highlight", 7],
      },
    ],
  },
  {
    title: "Feedback",
    note: "Always paired with an icon and words.",
    rows: [
      {
        token: "success",
        swatch: "bg-success",
        role: "Correct, mastered",
        check: ["--success", "--success-soft"],
      },
      {
        token: "warning",
        swatch: "bg-warning",
        role: "Repetition, learning, caution",
        check: ["--warning", "--warning-soft"],
      },
      {
        token: "danger",
        swatch: "bg-danger",
        role: "Incorrect, errors",
        check: ["--danger", "--danger-soft"],
      },
      { token: "info", swatch: "bg-info", role: "Neutral notes", check: ["--info", "--info-soft"] },
    ],
  },
];

function TokenTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-xl type-body">
        <thead>
          <tr className="border-b border-border-strong text-left">
            <th scope="col" className="h-9 px-3 type-overline text-subtle-foreground">
              Token
            </th>
            <th scope="col" className="h-9 px-3 type-overline text-subtle-foreground">
              Value
            </th>
            <th scope="col" className="h-9 px-3 type-overline text-subtle-foreground">
              Role
            </th>
            <th scope="col" className="h-9 px-3 text-right type-overline text-subtle-foreground">
              Contrast
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.token} className="border-b border-border-subtle last:border-0">
              <td className="h-11 px-3">
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn("size-4 shrink-0 rounded-xs border border-border", row.swatch)}
                  />
                  <span className="type-mono text-foreground">{row.token}</span>
                </span>
              </td>
              <td className="h-11 px-3">
                <TokenValue name={`--${row.token}`} />
              </td>
              <td className="h-11 px-3 text-muted-foreground">{row.role}</td>
              <td className="h-11 px-3 text-right">
                {row.check ? (
                  <ContrastRatio fg={row.check[0]} bg={row.check[1]} min={row.check[2]} />
                ) : (
                  <span className="type-mono text-subtle-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ColorSection() {
  return (
    <Section
      id="colour"
      eyebrow="Foundations"
      title="Colour"
      description="Warm neutrals do the work; colour carries meaning. Values and contrast ratios below are read live from the tokens."
    >
      {GROUPS.map((group) => (
        <Specimen key={group.title} title={group.title} note={group.note} className="p-2 sm:p-3">
          <TokenTable rows={group.rows} />
        </Specimen>
      ))}

      <Specimen
        title="Language categories"
        note="Soft fill, text and line per category. Colour identifies the kind of language — never quality."
        className="p-2 sm:p-3"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-xl type-body">
            <thead>
              <tr className="border-b border-border-strong text-left">
                <th scope="col" className="h-9 px-3 type-overline text-subtle-foreground">
                  Category
                </th>
                <th scope="col" className="h-9 px-3 type-overline text-subtle-foreground">
                  Badge
                </th>
                <th scope="col" className="h-9 px-3 type-overline text-subtle-foreground">
                  Tint
                </th>
                <th
                  scope="col"
                  className="h-9 px-3 text-right type-overline text-subtle-foreground"
                >
                  Contrast
                </th>
              </tr>
            </thead>
            <tbody>
              {LANGUAGE_CATEGORY_KEYS.map((key) => (
                <tr key={key} className="border-b border-border-subtle last:border-0">
                  <td className="h-11 px-3 type-mono text-foreground">cat-{key}</td>
                  <td className="h-11 px-3">
                    <span className="flex items-center gap-3">
                      <CategoryBadge category={key} />
                      <CategoryBadge category={key} variant="dot" />
                    </span>
                  </td>
                  <td className="h-11 px-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={cn("h-5 w-10 rounded-xs", LANGUAGE_CATEGORIES[key].soft)}
                      />
                      <span
                        aria-hidden
                        className={cn("size-5 rounded-xs", LANGUAGE_CATEGORIES[key].dot)}
                      />
                    </span>
                  </td>
                  <td className="h-11 px-3 text-right">
                    <ContrastRatio fg={`--cat-${key}`} bg={`--cat-${key}-soft`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Specimen>
    </Section>
  );
}
