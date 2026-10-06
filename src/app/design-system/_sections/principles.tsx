import { Section, Specimen } from "./section";

const TRANSLATION = [
  {
    principle: "Hierarchy by weight",
    observed:
      "One sans family everywhere; 600 headings, 500 controls, 400 body; tight display leading.",
    lexora:
      "Inter 600 for every interface heading. Newsreader appears only for English being learned.",
  },
  {
    principle: "Surface hierarchy",
    observed: "White canvas, warm-grey recessed surface, three hairline weights.",
    lexora:
      "Warm off-white canvas, white raised surfaces, recessed wells — border-subtle / border / border-strong.",
  },
  {
    principle: "Flat by default",
    observed: "Cards rest flat on a hairline; shadow only for lifted things.",
    lexora: "No resting shadows on cards or inputs. Shadow means lifted: hover, menus, dialogs.",
  },
  {
    principle: "Sober geometry",
    observed: "Rectangular 8px buttons, 12px cards; pills reserved for tabs and status.",
    lexora: "4 / 6 / 8 / 12 / 16 radius scale. Pills only for filter chips, status and avatars.",
  },
  {
    principle: "Two densities",
    observed: "Comfortable 44px marketing controls; compact product chrome.",
    lexora: "28–30px chrome, 36px buttons, 40px inputs, 44px forms and mobile, 56px hero search.",
  },
  {
    principle: "Search as a surface",
    observed: "Recessed search pill with a hairline; strong focus border.",
    lexora: "Recessed SearchTrigger opens the palette; the Finder gets a raised 56px hero field.",
  },
  {
    principle: "Pills switch, lines navigate",
    observed: "Pill tabs with a dark active fill; underline tabs for sections.",
    lexora:
      "FilterChip for categories, underline tabs for detail sections, segmented for binary views.",
  },
  {
    principle: "Tint as meaning",
    observed: "Pastel tints echo product properties; one bold tint for emphasis.",
    lexora: "Tints belong to language categories. The highlighter is the single emphasis tint.",
  },
  {
    principle: "Content rhythm",
    observed: "Eyebrow → headline → muted subtitle → actions → tiles; generous section spacing.",
    lexora:
      "PageHeader pattern, 48 / 64 / 96 section rhythm, descriptions capped near 60 characters.",
  },
];

const NOT_ADOPTED = [
  "A brand-coloured primary button — Lexora acts in charcoal; colour stays informational.",
  "Dark hero bands, illustrations and decorative scatter — calm beats atmosphere here.",
  "Saturated solid badges — status uses soft fills, one neutral solid for “Due”.",
  "Deep drop shadows — the strongest shadow is reserved for dialogs.",
  "Any reference branding, naming or typeface.",
];

export function PrinciplesSection() {
  return (
    <Section
      id="principles"
      eyebrow="Principles"
      title="From reference to Lexora"
      description="The references were studied for their underlying decisions, not their look. Each principle is restated in Lexora’s own terms below."
    >
      <Specimen title="Principle translation" className="p-0 sm:p-0">
        <div className="divide-y divide-border-subtle">
          {TRANSLATION.map((row) => (
            <div
              key={row.principle}
              className="flex flex-col gap-2 px-5 py-4 sm:px-6 lg:flex-row lg:gap-8"
            >
              <p className="type-label text-foreground lg:w-44 lg:shrink-0">{row.principle}</p>
              <p className="type-caption text-subtle-foreground lg:w-80 lg:shrink-0">
                {row.observed}
              </p>
              <p className="type-body text-foreground">{row.lexora}</p>
            </div>
          ))}
        </div>
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen title="Lexora signatures" note="What makes it recognisable.">
          <ol className="space-y-3 type-body text-foreground">
            <li>
              <span className="font-semibold">Serif means language.</span>{" "}
              <span className="text-muted-foreground">
                Interface in Inter; every word to learn in{" "}
                <span className="type-example">Newsreader</span>.
              </span>
            </li>
            <li>
              <span className="font-semibold">Category colour.</span>{" "}
              <span className="text-muted-foreground">
                Seven soft tints identify the kind of language — nothing else is colourful.
              </span>
            </li>
            <li>
              <span className="font-semibold">The highlighter.</span>{" "}
              <span className="text-muted-foreground">
                Target terms are{" "}
                <mark className="rounded-xs bg-highlight px-0.5 text-highlight-foreground">
                  marked
                </mark>{" "}
                like a study text.
              </span>
            </li>
            <li>
              <span className="font-semibold">Charcoal acts, ink guides.</span>{" "}
              <span className="text-muted-foreground">
                Actions are charcoal; links, focus and selection are ink.
              </span>
            </li>
          </ol>
        </Specimen>

        <Specimen title="Deliberately not adopted">
          <ul className="space-y-2.5 type-body text-muted-foreground">
            {NOT_ADOPTED.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span
                  aria-hidden
                  className="mt-2 size-1 shrink-0 rounded-full bg-subtle-foreground"
                />
                {item}
              </li>
            ))}
          </ul>
        </Specimen>
      </div>
    </Section>
  );
}
