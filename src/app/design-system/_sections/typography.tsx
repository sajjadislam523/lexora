import { CategoryBadge } from "@/components/lexora/category-badge";
import { cn } from "@/lib/utils";

import { Section, Specimen } from "./section";

const INTERFACE_ROLES = [
  {
    role: "type-display",
    spec: "Inter 600 · 36→52 · −2.5%",
    sample: "Find the right English.",
    use: "Onboarding and marketing hero",
  },
  {
    role: "type-title",
    spec: "Inter 600 · 26→32 · −2%",
    sample: "Language Finder",
    use: "Page title, one per page",
  },
  {
    role: "type-heading",
    spec: "Inter 600 · 20 · −1%",
    sample: "Saved expressions",
    use: "Section heading",
  },
  {
    role: "type-subheading",
    spec: "Inter 600 · 16",
    sample: "Common mistakes",
    use: "Card, group, dialog heading",
  },
  {
    role: "type-reading",
    spec: "Inter 400 · 16 / 1.6",
    sample: "Use “In contrast” to introduce a clear difference between two ideas.",
    use: "Explanations, descriptions",
  },
  {
    role: "type-body",
    spec: "Inter 400 · 14 / 1.55",
    sample: "Search vocabulary, prepositions, linkers and patterns.",
    use: "Interface default",
  },
  { role: "type-label", spec: "Inter 500 · 14", sample: "Register", use: "Labels, nav, buttons" },
  {
    role: "type-caption",
    spec: "Inter 400 · 13",
    sample: "Reviewed 2 days ago",
    use: "Metadata, hints",
  },
  { role: "type-micro", spec: "Inter 500 · 12", sample: "12 due", use: "Badges, counts" },
  {
    role: "type-overline",
    spec: "Inter 600 · 11 · +8% · caps",
    sample: "In writing",
    use: "Eyebrows, table headers",
  },
  {
    role: "type-mono",
    spec: "JetBrains Mono · 13",
    sample: "responsible for + noun / -ing",
    use: "Patterns, keys",
  },
];

const LANGUAGE_ROLES = [
  {
    role: "type-term-display",
    spec: "Newsreader 500 · 32→44",
    sample: "responsible for",
    use: "Language detail heading",
  },
  {
    role: "type-term",
    spec: "Newsreader 500 · 22",
    sample: "pose a threat",
    use: "A term in a card or list",
  },
  {
    role: "type-term-sm",
    spec: "Newsreader 500 · 16",
    sample: "In contrast,",
    use: "Terms in tables and palette",
  },
  {
    role: "type-example",
    spec: "Newsreader 400 · 18 / 1.6",
    sample: "Rising sea levels pose a serious threat to coastal cities.",
    use: "Example sentences",
  },
];

function RoleList({ roles }: { roles: typeof INTERFACE_ROLES }) {
  return (
    <ul className="divide-y divide-border-subtle">
      {roles.map((type) => (
        <li
          key={type.role}
          className="flex flex-col gap-1.5 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6 sm:px-6"
        >
          <div className="shrink-0 sm:w-56">
            <p className="type-mono text-foreground">{type.role}</p>
            <p className="type-caption text-subtle-foreground">{type.spec}</p>
          </div>
          <p className={cn("min-w-0 flex-1 text-foreground", type.role)}>{type.sample}</p>
          <p className="shrink-0 type-caption text-muted-foreground sm:w-44 sm:text-right">
            {type.use}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function TypographySection() {
  return (
    <Section
      id="typography"
      eyebrow="Foundations"
      title="Typography"
      description="Hierarchy comes from weight and size inside one sans family. The serif is reserved for one job: showing the English a learner is studying."
    >
      <Specimen title="The rule" note="Interface in Inter. Language in Newsreader.">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3 rounded-md bg-muted p-5">
            <p className="type-overline text-subtle-foreground">Interface — Inter</p>
            <p className="type-title text-foreground">Language bank</p>
            <p className="type-body text-muted-foreground">
              48 saved items · 12 due for review today
            </p>
            <p className="type-label text-foreground">Start review →</p>
          </div>
          <div className="space-y-3 rounded-md border border-border p-5">
            <p className="type-overline text-subtle-foreground">Language — Newsreader</p>
            <CategoryBadge category="collocation" />
            <p className="type-term-display text-foreground">pose a threat</p>
            <p className="type-example text-foreground">
              Rising sea levels{" "}
              <mark className="rounded-xs bg-highlight px-0.5 text-highlight-foreground">
                pose a serious threat
              </mark>{" "}
              to coastal cities.
            </p>
          </div>
        </div>
      </Specimen>

      <Specimen title="Interface roles" className="p-0 sm:p-0">
        <RoleList roles={INTERFACE_ROLES} />
      </Specimen>

      <Specimen title="Language roles" className="p-0 sm:p-0">
        <RoleList roles={LANGUAGE_ROLES} />
      </Specimen>
    </Section>
  );
}
